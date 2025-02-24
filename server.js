// finance_manager/server.js

import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Joi from 'joi';

import authRoutes from './routes/auth.js';
import transactionRoutes from './routes/transactions.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'Access Denied' });
  
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid Token' });
  }
};

// Validation Schemas
const transactionSchema = Joi.object({
  amount: Joi.number().required(),
  category: Joi.string().required(),
  type: Joi.string().valid('income', 'expense').required(),
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', authenticateToken, transactionRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error(err));

// User Model
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
});
const User = mongoose.model('User', userSchema);

// Transaction Model
const transactionSchemaMongo = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  amount: Number,
  category: String,
  type: String, // income or expense
  date: { type: Date, default: Date.now },
});
const Transaction = mongoose.model('Transaction', transactionSchemaMongo);

// Transaction Routes
app.post('/api/transactions', async (req, res) => {
  try {
    const { error } = transactionSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    
    const { amount, category, type } = req.body;
    const transaction = new Transaction({
      userId: req.user.userId,
      amount,
      category,
      type,
    });
    await transaction.save();
    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.userId });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { error } = transactionSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    
    const { amount, category, type } = req.body;
    const transaction = await Transaction.findByIdAndUpdate(req.params.id, { amount, category, type }, { new: true });
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));