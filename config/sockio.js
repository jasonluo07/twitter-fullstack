const { Op } = require('sequelize')
const db = require('./../models')
const { Message, User, PrivateMessage } = db

module.exports = (io) => {
  const onlineUser = []

  io.on('connection', async (socket) => {
    let user

    // 使用者上線
    socket.on('connectUser', async (userId) => {
      user = await User.findByPk(userId, {
        attributes: ['id', 'name', 'account', 'avatar'],
        raw: true
      })
      io.emit('notifySignin', user)
      broadcastOnlineUser(user)
    })

    // 使用者下線
    socket.on('disconnect', () => {
      io.emit('notifySignout', user)
      broadcastOnlineUser(undefined, user)
    })

    // 取得歷史訊息
    const previousMessages = await Message.findAll({
      include: [
        {
          model: User,
          attributes: ['id', 'name', 'account', 'avatar']
        }
      ],
      attributes: ['id', 'text', 'createdAt'],
      order: [['createdAt', 'ASC']],
      raw: true,
      nest: true
    })
    io.emit('getPreviousMessages', previousMessages)

    // 建立訊息
    socket.on('createMessage', async (data) => {
      try {
        const query = await Message.create({
          UserId: data.UserId,
          text: data.text
        })
        // console.log(query.dataValues)
        // 確定建立完資料，才把資料拿出來
        const newMessage = await Message.findOne({
          where: {
            ...query.dataValues
          },
          include: [
            {
              model: User,
              attributes: ['id', 'name', 'avatar']
            }
          ],
          raw: true,
          nest: true
        })
        console.log('newMessage', newMessage)

        io.emit('getNewMessage', newMessage)
      } catch (err) {
        console.error(err)
      }
    })

    // 以下 Pri chatroom
    let room = []
    let opUsers = []

    socket.on('connectUserPri', async (userId) => {
      let priMsg = await PrivateMessage.findAll({
        where: {
          [Op.or]: [
            { senderId: userId },
            { receiverId: userId }
          ]
        },
        raw: true,
        order: [['createdAt', 'DESC']]
      })

      // 找出room組合 及所有不是自己的user
      priMsg.forEach(item => {
        room.push(item.senderId < item.receiverId ? item.senderId + '=' + item.receiverId : item.receiverId + '=' + item.senderId)

        if (item.senderId !== userId) {
          opUsers.push(item.senderId)
        } else {
          opUsers.push(item.receiverId)
        }

      })
      // 清除重複
      room = [...(new Set(room))]
      opUsers = [...(new Set(opUsers))]

      // 加入連線
      socket.join(room)

      opUsers = await Promise.all(opUsers.map(id => {
        return User.findByPk(id, { raw: true })
      }))

      socket.emit(`pri users for ${userId}`, opUsers)

    })

    socket.on('connectUserPriRoom', async (userId, roomid, opId) => {
      let [priMsg, opUser] = await Promise.all([
        PrivateMessage.findAll({
          where: {
            [Op.or]: [
              { senderId: userId },
              { receiverId: userId }
            ]
          },
          raw: true,
          order: [['createdAt', 'DESC']]
        }),
        User.findByPk(opId, {

        })
      ])

      socket.to(roomid).emit('getPriPreMsg', { priMsg, opUser })



    })




  })


  function broadcastOnlineUser(userON, userOFF = undefined) {
    if (userON) { onlineUser.push(userON) }
    if (userOFF) {
      onlineUser
        .splice(onlineUser.indexOf(userOFF), 1)
    }
    return io.emit('getOnlineUser', {
      onlineUser,
      onlineUserCount: onlineUser.length
    })
  }

}
