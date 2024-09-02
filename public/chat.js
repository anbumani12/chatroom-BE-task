const socket = io();

const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
const roomList = document.getElementById("roomList");
const activeRoomsElement = document.getElementById("active-rooms");
const usersInRoom = document.getElementById("usersInRoom");
const joinRoomForm = document.getElementById("joinRoomForm");
const roomnameInput = document.getElementById("roomname");
const usernameInput = document.getElementById("username");
const errorMessageElement = document.getElementById("error-message");
const currentRoomName = document.getElementById("currentRoomName");
const typingNotification = document.getElementById("typingNotification");

const ROOM_STATUS_KEY = "roomStatus";
const TAB_ID_KEY = "tabId";
const SECOND_USER_KEY = "secondUser";
const FIRST_USER_KEY = "firstUser";

const generateTabId = () => `${Date.now()}`;

const getTabId = () => {
  let tabId = localStorage.getItem(TAB_ID_KEY);
  if (!tabId) {
    tabId = generateTabId();
    localStorage.setItem(TAB_ID_KEY, tabId);
  }
  return tabId;
};

const setFirstUser = (username) => {
  localStorage.setItem(FIRST_USER_KEY, username);
};

const getFirstUser = () => {
  return localStorage.getItem(FIRST_USER_KEY);
};

const initializeChatUI = () => {
  const welcomeMessage = document.getElementById("welcome-message");
  if (welcomeMessage) {
    welcomeMessage.textContent = "Welcome to Chat App!";
  }
  const activeRoomsElement = document.getElementById("active-rooms");
  const userInfoElement = document.getElementById("user-info");
  if (activeRoomsElement) {
    activeRoomsElement.style.display = "none";
  }
  if (userInfoElement) {
    userInfoElement.style.display = "none";
  }
};

const updateActiveRoomsFromStorage = () => {
  const activeRooms = localStorage.getItem("activeRooms");
  if (activeRooms) {
    roomList.textContent = activeRooms;
    document.getElementById("active-rooms").style.display = "block";
  } else {
    initializeChatUI();
  }
};

const handleRoomStatus = () => {
  localStorage.removeItem(ROOM_STATUS_KEY);
  initializeChatUI();
};

document.addEventListener("DOMContentLoaded", () => {
  const tabId = getTabId();
  const isSecondTab = localStorage.getItem("secondTab") === tabId;
  if (isSecondTab) {
    updateActiveRoomsFromStorage();
    handleRoomStatus();
    localStorage.setItem(SECOND_USER_KEY, tabId);
  } else {
    localStorage.setItem("firstTab", tabId);
  }
});

window.addEventListener("storage", (event) => {
  if (
    event.key === "activeRooms" &&
    localStorage.getItem("secondTab") === getTabId()
  ) {
    roomList.textContent = event.newValue || "No active rooms";
    document.getElementById("active-rooms").style.display = event.newValue
      ? "block"
      : "none";
  }
  if (event.key === FIRST_USER_KEY) {
    const firstUser = event.newValue;
    const allMessages = messages.querySelectorAll("p");
    allMessages.forEach((message) => {
      const messageText = message.textContent;
      if (messageText.includes(firstUser)) {
        message.textContent = messageText.replace(firstUser, "");
      }
    });
  }
});

const addMessage = (sender, text, timestamp = null) => {
  const item = document.createElement("p");

  const firstUser = getFirstUser();
  let messageText = "";
  if (sender === firstUser) {
    messageText = `${text}`;
  } else {
    messageText = `${sender ? sender + " " : ""}${text}`;
  }
  if (timestamp) {
    messageText += ` ${timestamp}`;
  }

  item.innerHTML = messageText;
  messages.appendChild(item);
  window.scrollTo(0, document.body.scrollHeight);
};

socket.on("chat message", function (msg) {
  const { sender, text, timestamp } = msg;
  addMessage(sender, text, timestamp);
});

form.addEventListener("submit", function (e) {
  e.preventDefault();

  if (input.value.trim()) {
    errorMessageElement.style.display = "none";

    socket.emit("chat message", {
      sender: usernameInput.value,
      text: input.value,
    });

    input.value = "";

    socket.emit("stop typing", usernameInput.value);

    typingNotification.textContent = "";
  } else {
    errorMessageElement.style.display = "block";
  }
});

input.addEventListener("input", function () {
  if (input.value.trim()) {
    socket.emit("typing", usernameInput.value);
  } else {
    socket.emit("stop typing", usernameInput.value);
  }
});

socket.on("typing", function (username) {
  typingNotification.textContent = ` ${username} is typing...`;
});

socket.on("stop typing", function () {
  typingNotification.textContent = "";
});

joinRoomForm.addEventListener("submit", function (e) {
  e.preventDefault();
  const roomName = roomnameInput.value.trim();
  const username = usernameInput.value.trim();

  if (roomName && username) {
    currentUsername = username;

    socket.emit("set username", username);
    socket.emit("join room", { roomName, username });

    roomnameInput.placeholder = roomName;
    usernameInput.placeholder = username;

    roomnameInput.value = "";
    usernameInput.value = "";

    currentRoomName.textContent = roomName;
    document.getElementById("active-rooms").style.display = "block";
    document.getElementById("user-info").style.display = "block";

    errorMessageElement.style.display = "none";
    const welcomeMessage = document.getElementById("welcome-message");
    if (welcomeMessage) {
      welcomeMessage.textContent = "";
    }

    let firstUser = getFirstUser();
    if (!firstUser) {
      setFirstUser(username);
    }

    localStorage.setItem(ROOM_STATUS_KEY, "active");
    localStorage.setItem("secondTab", getTabId());
  } else {
    errorMessageElement.textContent = "Both name and room are required.";
    errorMessageElement.style.display = "block";
  }
});

let firstUser = null;

socket.on("user joined", function ({ username }) {
  if (typeof username === "string") {
    if (!firstUser) {
      firstUser = username;
    }

    const tabId = getTabId();
    const isCurrentUser = username === currentUsername;
    if (isCurrentUser) {
      addMessage("You", "have joined the room");
    } else {
      addMessage(username, "has joined the room");
    }
  } else {
    console.error("Invalid user joined data:", { username });
  }
});

socket.on("update users", function (users) {
  if (Array.isArray(users)) {
    usersInRoom.textContent = users.length > 0 ? users.join(", ") : "None";
    document.getElementById("user-info").style.display = users.length
      ? "block"
      : "none";
  } else {
    console.error("Received data for users is not an array:", users);
  }
});

socket.on("update rooms", (rooms) => {
  console.log("Active rooms received from server:", rooms);
  const tabId = getTabId();
  const isSecondTab = localStorage.getItem("secondTab") === tabId;

  if (isSecondTab) {
    if (Array.isArray(rooms)) {
      const validRooms = rooms.filter(
        (room) => typeof room === "string" && room.trim() !== ""
      );
      roomList.textContent =
        validRooms.length > 0 ? validRooms.join(", ") : "No active rooms";
      activeRoomsElement.style.display =
        validRooms.length > 0 ? "block" : "none";
      localStorage.setItem("activeRooms", validRooms.join(", "));
    } else {
      console.error("Received data for rooms is not an array:", rooms);
      roomList.textContent = "No active rooms";
      activeRoomsElement.style.display = "none";
    }
  }
});
