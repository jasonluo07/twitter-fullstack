const socketService = require('./socketService')

module.exports = io => {
  const notiOnlineUsers = []
  const publicOnlineUsers = []
  const privateOnlineUsers = []

  io.on('connection', socket => {
    // userId for this connection
    let userId

    // ------------- noti -------------
    socket.on('connectLogin', loginUserId => {
      // 登入，加入清單 notiOnlineUsers，建立room
      notiOnlineUsers.push(loginUserId)
      userId = loginUserId
      socket.join(userId)

      // 離線，移除登入清單 notiOnlineUsers
      socket.on('disconnect', reason => {
        notiOnlineUsers.splice(notiOnlineUsers.indexOf(userId), 1)
      })

      // 送出歷史通知 (Public, Private, Noti)
      Promise.all([
        socketService.getPublicNoti(userId),
        socketService.getPrivateNoti(userId),
        socketService.getNotiNoti(userId)
      ]).then(results => {
        io.to(userId).emit('getPreviousNoti', {
          getPublicNoti: results[0],
          getPrivateNoti: results[1],
          getNotiNoti: results[2]
        })
      })
    })

    // ------------- public -------------

    socket.on('connectPublicUser', async loginUserId => {
      // 上線加入清單
      publicOnlineUsers.push(loginUserId)
      const user = await socketService.getUserInfo(loginUserId)

      // 送出public歷史訊息
      io.emit('getPreviousMessages', await socketService.getPreviousMsg())

      // 送出public已在線使用者
      io.emit(
        'getConnectedPublicUser',
        await socketService.getPreviousUser(publicOnlineUsers)
      )

      // 廣播自己上線
      io.emit('getPublicMsg', { notifyType: 'signin', user })

      // 離線移除清單，廣播
      socket.on('disconnect', async reason => {
        publicOnlineUsers.splice(publicOnlineUsers.indexOf(loginUserId), 1)

        io.emit('getPublicMsg', { notifyType: 'signout', user })

        io.emit(
          'getConnectedPublicUser',
          await socketService.getPreviousUser(publicOnlineUsers)
        )
      })

      // 接收public訊息，儲存，廣播
      socket.on('createPublicMsg', async data => {
        const [msg, user] = await Promise.all([
          socketService.createMessage(data),
          socketService.getUserInfo(data.UserId)
        ])

        io.emit('getPublicMsg', { notifyType: 'message', msg, user })
      })
    })
    // updateOnlineUser()
    // console.log(socket)

    // let user

    // socket.on('connectLogin', (data) => {
    //   onlineUser.push(data)
    //   user = data
    //   socket.emit('noti-message-login', data)
    //   updateOnlineUser()
    // })

    // socket.on('send pub msg', (data) => {
    //   socket.emit('pub msg', data)
    // })

    // socket.on('disconnect', () => {
    //   socket.emit('noti-message-logout', user)
    //   onlineUser.splice(onlineUser.indexOf(user), 1)
    //   updateOnlineUser()
    // })

    // ------------- private -------------
  })

  // ------------- functions -------------
  function broadcastNotiNoti (userIdList, data) {
    // data require type('未讀的追蹤者推文' or '未讀的被讚事件'), TweetId, Tweet(all) User(avatar, name)
    io.to(userIdList).emit('getNotiNoti', data)
  }

  function broadcastPrivateNoti (roomList, userIdList, data) {
    // data require receiverId, text, date, time
    io.to(roomList).emit('getPrivateNoti', data)
    io.to(userIdList).emit('getPrivateNoti', true)
  }

  function broadcastPublicNoti (userIdList, data) {
    // data require text, userId, date, time, user(name, account, avatar)
    io.emit('getPublicNoti', data)
    io.to(userIdList).emit('getPublicNoti', true)
  }

  // function updatePublicOnlineUsers() {
  //   io.emit('onlineUser', onlineUser, { onlineCount: onlineUser.length })
  //   console.log(onlineUser)
  // }
}
