const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

async function signup({ email, password, isAdmin }) {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error('User already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({
    email,
    password: hashedPassword,
    isAdmin: isAdmin || false,
  });

  await newUser.save();

  const token = jwt.sign(
  { 
    userId: newUser._id, 
    role: newUser.isAdmin ? 'admin' : 'user'   // add role here
  }, 
  process.env.JWT_SECRET, 
  { expiresIn: '1h' }
);

  return { user: newUser, token };
}


async function login(email, password) {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('User not found');
  }
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }
 const token = jwt.sign(
  { 
    userId: user._id, 
    role: user.isAdmin ? 'admin' : 'user'   // add role here
  }, 
  process.env.JWT_SECRET, 
  { expiresIn: '1h' }
);
  return token;
}

module.exports = {
  signup,
  login,
};
