const TransactionModel = require("../models/transactionModel");
const ProductModel = require("../models/productModel");
const CustomerModel = require("../models/customerModel");

const TransactionController = {
  // Membuat transaksi baru
  createTransaction: async (req, res) => {
    const { customerId, items } = req.body;

    if (!customerId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Customer ID dan daftar item transaksi wajib diisi",
      });
    }

    try {
      const customer = await CustomerModel.findById(customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer tidak ditemukan" });
      }

      let totalAmount = 0;
      const processedItems = [];

      for (const item of items) {
        const product = await ProductModel.findById(item.productId);
        if (!product) {
          return res.status(404).json({
            message: `Produk dengan ID ${item.productId} tidak ditemukan`,
          });
        }

        if (product.stock < item.quantity) {
          return res.status(400).json({
            message: `Stok produk ${product.name} tidak mencukupi. Tersedia: ${product.stock}`,
          });
        }

        totalAmount += product.price * item.quantity;

        processedItems.push({
          productId: product.id,
          quantity: item.quantity,
          pricePerItem: product.price,
          remainingStock: product.stock - item.quantity,
        });
      }

      const transactionId = await TransactionModel.createTransaction(
        customerId,
        totalAmount,
        "pending"
      );

      for (const item of processedItems) {
        await TransactionModel.addTransactionItem(
          transactionId,
          item.productId,
          item.quantity,
          item.pricePerItem
        );

        await ProductModel.update(item.productId, item.remainingStock);
      }

      res.status(201).json({
        message: "Transaksi berhasil dibuat",
        transactionId,
      });
    } catch (error) {
      console.error("Gagal membuat transaksi:", error);
      res.status(500).json({ message: "Terjadi kesalahan saat membuat transaksi" });
    }
  },

  // Mendapatkan detail transaksi berdasarkan ID
  getTransactionById: async (req, res) => {
    const { id } = req.params;

    try {
      const transactionItems = await TransactionModel.findById(id);

      if (transactionItems.length === 0) {
        return res.status(404).json({ message: "Transaksi tidak ditemukan" });
      }

      const transaction = {
        id: transactionItems[0].id,
        customer_id: transactionItems[0].customer_id,
        total_amount: transactionItems[0].total_amount,
        status: transactionItems[0].status,
        transaction_date: transactionItems[0].transaction_date,
        items: transactionItems.map((item) => ({
          item_id: item.item_id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          price_per_item: item.price_per_item,
        })),
      };

      res.status(200).json(transaction);
    } catch (error) {
      console.error("Gagal mengambil transaksi:", error);
      res.status(500).json({ message: "Terjadi kesalahan saat mengambil transaksi" });
    }
  },

  // Mendapatkan semua transaksi berdasarkan customer ID
  getTransactionsByCustomerId: async (req, res) => {
    const { customerId } = req.params;

    try {
      const transactionItems = await TransactionModel.findByCustomerId(customerId);

      if (transactionItems.length === 0) {
        return res.status(404).json({ message: "Transaksi tidak ditemukan untuk customer ini" });
      }

      const transactionsMap = new Map();

      transactionItems.forEach((item) => {
        if (!transactionsMap.has(item.id)) {
          transactionsMap.set(item.id, {
            id: item.id,
            customer_id: item.customer_id,
            total_amount: item.total_amount,
            status: item.status,
            transaction_date: item.transaction_date,
            items: [],
          });
        }

        transactionsMap.get(item.id).items.push({
          item_id: item.item_id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          price_per_item: item.price_per_item,
        });
      });

      res.status(200).json(Array.from(transactionsMap.values()));
    } catch (error) {
      console.error("Gagal mengambil transaksi customer:", error);
      res.status(500).json({ message: "Terjadi kesalahan saat mengambil transaksi customer" });
    }
  },

  // Mengupdate status transaksi
  updateTransactionStatus: async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["pending", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Status tidak valid" });
    }

    try {
      const affectedRows = await TransactionModel.updateStatus(id, status);

      if (affectedRows === 0) {
        return res.status(404).json({ message: "Transaksi tidak ditemukan atau tidak berubah" });
      }

      res.status(200).json({ message: "Status transaksi berhasil diperbarui" });
    } catch (error) {
      console.error("Gagal mengupdate status transaksi:", error);
      res.status(500).json({ message: "Terjadi kesalahan saat mengupdate status transaksi" });
    }
  },

  // Menghapus transaksi
  deleteTransaction: async (req, res) => {
    const { id } = req.params;

    try {
      const affectedRows = await TransactionModel.delete(id);

      if (affectedRows === 0) {
        return res.status(404).json({ message: "Transaksi tidak ditemukan" });
      }

      res.status(200).json({ message: "Transaksi berhasil dihapus" });
    } catch (error) {
      console.error("Gagal menghapus transaksi:", error);
      res.status(500).json({ message: "Terjadi kesalahan saat menghapus transaksi" });
    }
  },

  // Mendapatkan semua transaksi
  getAllTransactions: async (req, res) => {
    try {
      const transactionItems = await TransactionModel.getAll();

      if (transactionItems.length === 0) {
        return res.status(200).json([]);
      }

      const transactionsMap = new Map();

      transactionItems.forEach((item) => {
        if (!transactionsMap.has(item.id)) {
          transactionsMap.set(item.id, {
            id: item.id,
            customer_id: item.customer_id,
            total_amount: item.total_amount,
            status: item.status,
            transaction_date: item.transaction_date,
            items: [],
          });
        }

        transactionsMap.get(item.id).items.push({
          item_id: item.item_id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          price_per_item: item.price_per_item,
        });
      });

      res.status(200).json(Array.from(transactionsMap.values()));
    } catch (error) {
      console.error("Gagal mengambil semua transaksi:", error);
      res.status(500).json({ message: "Terjadi kesalahan saat mengambil semua transaksi" });
    }
  },
};

module.exports = TransactionController;
