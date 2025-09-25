import express from "express";
import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3500;
const ADMIN = "Admin";
const app = express();
app.use(express.static(path.join(__dirname, "public")));
const expressServer = app.listen(PORT, () => {
	console.log(`listening on port no : ${PORT}`);
});
// state
const UsersState = {
	users: [],
	setUsers: function (newUsersArray) {
		this.users = newUsersArray;
	},
};
const io = new Server(expressServer, {
	cors: {
		origin:
			process.env.NODE_ENV === "production"
				? false
				: [
						"http://localhost:3000",
						"http://localhost:3001",
						"http://localhost:5500",
						"http://127.0.0.1:5500",
						"http://localhost:8080",
						"http://127.0.0.1:3000",
				],
	},
});
io.on("connection", (socket) => {
	console.log(`User ${socket.id} connected`);
	//upon connestion only seen by user
	socket.emit("message", buildMsg(ADMIN, "Welcome to vocular"));
	socket.on("enterRoom", ({ name, room }) => {
		const prevRoom = getUser(socket.id)?.room;
		if (prevRoom) {
			socket.leave(prevRoom);
			io.to(prevRoom).emit(
				"message",
				buildMsg(ADMIN, `${name} has left the room`)
			);
		}
		const user = activateUser(socket.id, name, room);
		// cannot update previous users list until after the state update in activate user
		if (prevRoom) {
			io.to(prevRoom).emit("userList", {
				users: getUsersInRoom(prevRoom),
			});
		}
		// join room
		socket.join(user.room);
		// to user who joined
		socket.emit(
			"message",
			buildMsg(ADMIN, `You have Joined the ${user.room} chat room`)
		);
		// to everyone else
		socket.broadcast
			.to(user.room)
			.emit(
				"message",
				buildMsg(ADMIN, `${user.name} has joined the room`)
			);
		//update user list for room
		io.to(user.room).emit("userList", {
			user: getUsersInRoom(user.room),
		});
		//update room list for everyone
		io.emit("roomList", {
			rooms: getAllActiveRooms(),
		});
	});
	socket.on("disconnect", () => {
		const user = getUser(socket.id);
		//user leaves app
		userLeavesApp(socket.id);
		if (user) {
			io.to(user.room).emit(
				"message",
				buildMsg(ADMIN, `${user.room} has left the room`)
			);
			io.to(user.room).emit("userList", {
				users: getUsersInRoom(user.room),
			});
			io.emit("roomList", {
				rooms: getAllActiveRooms(),
			});
		}
		console.log(`User ${socket.id} disconnected`);
	});
	// listening for a message event
	socket.on("message", ({ name, text }) => {
		const room = getUser(socket.id)?.room;
		if (room) {
			io.to(room).emit("message", buildMsg(name, text));
		}
	});
	// listen for activity, to all others
	socket.on("activity", (name) => {
		const room = getUser(socket.id)?.room;
		if (room) {
			socket.broadcast.to(room).emit("activity", name);
		}
		socket.broadcast.emit("activity", name);
	});
});
function buildMsg(name, text) {
	return {
		name,
		text,
		time: new Intl.DateTimeFormat("default", {
			hour: "numeric",
			minute: "numeric",
			second: "numeric",
		}).format(new Date()),
	};
}
// user functions
function activateUser(id, name, room) {
	const user = { id, name, room };
	UsersState.setUsers([
		...UsersState.users.filter((user) => user.id !== id),
		user,
	]);
	return user;
}
function userLeavesApp(id) {
	UsersState.setUsers(UsersState.users.filter((user) => user.id !== id));
}
function getUser(id) {
	return UsersState.users.find((user) => user.id === id);
}
function getUsersInRoom(room) {
	return UsersState.users.filter((user) => user.room === room);
}
function getAllActiveRooms() {
	return Array.from(new Set(UsersState.users.map((user) => user.room)));
}
