import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { AuthPayload } from "../types";
import * as messageService from "../services/message.service";
import {
  setSocketServer,
} from "../services/notification.service";
import { setMessageSocketServer } from "../services/message.service";

interface AuthenticatedSocket extends Socket {
  user?: AuthPayload;
}

const typingUsers = new Map<string, Set<string>>();

export function initSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    path: "/api/socket",
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  setSocketServer(io);
  setMessageSocketServer(io);

  io.use((socket: AuthenticatedSocket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.toString().slice(7);

    if (!token) return next(new Error("Unauthorized"));

    try {
      socket.user = jwt.verify(token, config.jwtSecret) as AuthPayload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    const userId = socket.user!.userId;

    socket.on("join:user", () => {
      socket.join(`user:${userId}`);
    });

    socket.on("join:discussion", (groupId: string) => {
      socket.join(`discussion:${groupId}`);
    });

    socket.on(
      "typing:start",
      ({ groupId }: { groupId: string }) => {
        if (!typingUsers.has(groupId)) {
          typingUsers.set(groupId, new Set());
        }
        typingUsers.get(groupId)!.add(userId);
        socket.to(`discussion:${groupId}`).emit("typing:start", {
          groupId,
          userId,
        });
      }
    );

    socket.on(
      "typing:stop",
      ({ groupId }: { groupId: string }) => {
        typingUsers.get(groupId)?.delete(userId);
        socket.to(`discussion:${groupId}`).emit("typing:stop", {
          groupId,
          userId,
        });
      }
    );

    socket.on(
      "send:message",
      async (data: {
        groupId: string;
        content: string;
        attachments?: string[];
        mentionedUserIds?: string[];
      }) => {
        const message = await messageService.createMessage(userId, data);
        socket.emit("message:sent", message);
      }
    );

    socket.on("disconnect", () => {
      for (const [groupId, users] of typingUsers.entries()) {
        if (users.has(userId)) {
          users.delete(userId);
          socket.to(`discussion:${groupId}`).emit("typing:stop", {
            groupId,
            userId,
          });
        }
      }
    });
  });

  return io;
}
