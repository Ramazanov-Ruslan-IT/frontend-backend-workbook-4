/************************************************
 * backend-admin/server.js
 ************************************************/
const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 8080;
const DATA_FILE = path.join(__dirname, "../data/products.json");

app.use(express.json());
app.use(cors());

// Читать / записывать файл
function readProducts() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) || [];
  } catch (err) {
    console.error("❌ Ошибка чтения JSON:", err);
    return [];
  }
}

function writeProducts(products) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("❌ Ошибка записи JSON:", err);
    return false;
  }
}

// GET (список товаров)
app.get("/products", (req, res) => {
  console.log("📥 GET /products");
  res.json(readProducts());
});

// POST (добавление товара)
app.post("/products", (req, res) => {
  console.log("📤 POST /products", req.body);
  let products = readProducts();

  const maxId =
    products.length > 0 ? Math.max(...products.map((p) => p.id || 0)) : 0;
  const newProduct = { id: maxId + 1, ...req.body };

  products.push(newProduct);

  if (writeProducts(products)) {
    console.log("✅ Товар добавлен:", newProduct);
    res.status(201).json(newProduct);
  } else {
    res.status(500).json({ error: "Ошибка записи" });
  }
});

// DELETE (удаление товара)
app.delete("/products/:id", (req, res) => {
  console.log("🗑️ DELETE /products", req.params.id);

  const products = readProducts();
  const productId = Number(req.params.id);

  if (isNaN(productId)) {
    return res.status(400).json({ error: "Некорректный ID" });
  }

  const filtered = products.filter((p) => Number(p.id) !== productId);

  if (filtered.length === products.length) {
    return res.status(404).json({ error: "Товар не найден" });
  }

  if (writeProducts(filtered)) {
    console.log(`✅ Товар с ID ${productId} удалён`);
    res.status(200).json({ message: "Товар удалён" });
  } else {
    res.status(500).json({ error: "Ошибка записи" });
  }
});

// Запускаем
app.listen(PORT, () => {
  console.log(`✅ [Админ] REST API запущено на http://localhost:${PORT}`);
});
