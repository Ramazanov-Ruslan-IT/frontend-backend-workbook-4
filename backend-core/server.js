/************************************************
 * backend-core/server.js
 ************************************************/
const express = require("express");
const path = require("path");
const cors = require("cors");

// GraphQL (Apollo)
const { ApolloServer, gql } = require("apollo-server-express");

// Socket.io
const http = require("http");
const { Server } = require("socket.io");

// FS для чтения products.json
const fs = require("fs");

const PORT = 3000;
const DATA_FILE = path.join(__dirname, "../data/products.json");

const app = express();

// CORS (если нужно)
app.use(cors());

// 1) Функции чтения/записи JSON (Только чтение нужно для GraphQL)
function readProducts() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) || [];
  } catch (err) {
    console.error("❌ Ошибка чтения JSON:", err);
    return [];
  }
}

// 2) GraphQL-схема (gql).
//    Допустим, покупателю нужны ТОЛЬКО часть полей (id, name, price).
const typeDefs = gql`
  type Product {
    id: ID!
    name: String
    price: Float
  }

  type Query {
    # Список ВСЕХ товаров (только id, name, price)
    products: [Product]

    # Один товар по ID
    product(id: ID!): Product
  }
`;

// 3) Резолверы: описываем логику получения данных
const resolvers = {
  Query: {
    products: () => {
      const products = readProducts();
      // Обрезаем поля до нужных
      return products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
      }));
    },
    product: (_, args) => {
      const products = readProducts();
      const found = products.find((p) => String(p.id) === String(args.id));
      if (!found) return null;
      return {
        id: found.id,
        name: found.name,
        price: found.price,
      };
    },
  },
};

// 4) Создаём Apollo Server (GraphQL)
async function startApollo() {
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  server.applyMiddleware({ app, path: "/graphql" });
}

// 5) Раздаём статические файлы из ../frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// 6) Создаём HTTP-сервер (для Socket.io + Express)
const httpServer = http.createServer(app);

// 7) Настраиваем Socket.io (чат между покупателем и админом)
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("[WS] Пользователь подключился:", socket.id);

  // Получаем сообщение
  socket.on("chatMessage", (msg) => {
    // msg = { text, role: 'user' | 'admin' }
    console.log(`[WS] Сообщение от ${socket.id} (${msg.role}):`, msg.text);

    // Рассылаем ВСЕМ подключённым
    io.emit("chatMessage", {
      text: msg.text,
      role: msg.role,
      senderId: socket.id,
    });
  });

  // Отключение
  socket.on("disconnect", () => {
    console.log("[WS] Пользователь отключился:", socket.id);
  });
});

// 8) Запускаем всё
async function start() {
  // Запускаем GraphQL
  await startApollo();

  // Запускаем HTTP + Socket.io
  httpServer.listen(PORT, () => {
    console.log(`✅ [Покупатель] Сервер запущен: http://localhost:${PORT}/`);
    console.log(
      `   GraphQL доступен по адресу: http://localhost:${PORT}/graphql`
    );
  });
}

start().catch((err) => {
  console.error("Ошибка запуска сервера:", err);
});
