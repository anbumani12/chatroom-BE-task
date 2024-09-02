const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = 3000;

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index");
});

let users = {};
let rooms = {};

function getFormattedTime() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")} ${period}`;
}

function updateRoomAndUserLists(roomName) {
  if (rooms[roomName] && rooms[roomName].length === 0) {
    delete rooms[roomName];
  }
  io.to(roomName).emit("update users", rooms[roomName]?.map(id => users[id] || "Anonymous") || []);
}

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("set username", (username) => {
    users[socket.id] = username;
    socket.username = username;
  });

  socket.on("chat message", (msg) => {
    const roomName = socket.currentRoom;
    if (roomName) {
      const isSecondUser = rooms[roomName].indexOf(socket.id) === 1;
      const messageData = {
        sender: socket.username || "Anonymous",
        text: msg.text,
        timestamp: isSecondUser ? getFormattedTime() : null,
      };
      io.to(roomName).emit("chat message", messageData);
    }
  });

  socket.on("typing", () => {
    const roomName = socket.currentRoom;
    if (roomName) {
      socket.broadcast.to(roomName).emit("typing", socket.username || "Anonymous");
    }
  });

  socket.on("stop typing", () => {
    const roomName = socket.currentRoom;
    if (roomName) {
      socket.broadcast.to(roomName).emit("stop typing");
    }
  });

  socket.on("join room", ({ roomName, username }) => {
    if (username) {
      socket.username = username;
    }
    if (!rooms[roomName]) {
      rooms[roomName] = [];
    }
    socket.join(roomName);
    socket.currentRoom = roomName;
    rooms[roomName].push(socket.id);
    updateRoomAndUserLists(roomName);
    io.to(roomName).emit("user joined", { username: socket.username });
    io.emit("update rooms", Object.keys(rooms));
  });

  socket.on("disconnect", () => {
    const roomName = socket.currentRoom;
    if (roomName) {
      const index = rooms[roomName].indexOf(socket.id);
      if (index !== -1) {
        rooms[roomName].splice(index, 1);
        updateRoomAndUserLists(roomName);
        io.to(roomName).emit("user left", { username: socket.username });
      }
    }
    delete users[socket.id];
    io.emit("update rooms", Object.keys(rooms));
    console.log("A user disconnected:", socket.id);
  });
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
