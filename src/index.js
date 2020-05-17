const socketio = require('socket.io');
const http = require('http'); // lo necestio para hacer algo manual y darle lugar a socket.io
const express = require('express');
const path = require('path');
const Filter = require('bad-words');
const { generateMessage } = require('./utils/messages');
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users');

const app = express();
const server = http.createServer(app); // lo llamo para darle lugar a socket.io ( esto sucede automaticamente sino lo hago asi)
const io = socketio(server); // creo una instancia de socket.io y le mando el server ( para esto es el http)

const port = process.env.PORT || 3000;

const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

io.on('connection', (socket) => {
    console.log('New Websocket connection');

    socket.on('join', (options, callback) => {
        const { error, user } = addUser({ id: socket.id, ...options });

        if (error) {
            return callback(error);
        }

        socket.join(user.room);
        socket.emit('message', generateMessage({ username: 'ADMIN', text: 'Welcome!' }));
        socket.broadcast.to(user.room).emit('message', generateMessage({ username: 'ADMIN', text: `${user.username} has joined!` }));

        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback();
    });

    socket.on('sendMessage', (msg, callback) => {
        const filter = new Filter();

        if (filter.isProfane(msg)) {
            return callback('Profanity is not allowed!');
        }

        const user = getUser(socket.id);

        io.to(user.room).emit('message', generateMessage({ username: user.username, text: msg }));

        callback();
    });

    socket.on('sendLocation', (location, callback) => {
        const user = getUser(socket.id);

        io.to(user.room).emit('locationMessage', generateMessage({ username: user.username, text: `https://google.com/maps?q=${location.lat},${location.lon}` }));

        callback();
    });

    socket.on('disconnect', () => {
        const user = removeUser(socket.id);

        if (user) {
            io.to(user.room).emit('message', generateMessage({ username: 'ADMIN', text: `${user.username} has left!` }));
            io.to(user.room).emit('roomData',
                {
                    room: user.room,
                    users: getUsersInRoom(user.room)
                }
            );
        }
    });
});

// escucho el server en vez de la app
server.listen(port, () => {
    console.log(`Express server running on port ${port}!`);
});

