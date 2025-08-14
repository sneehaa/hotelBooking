const bcrypt = require('bcrypt');  
const jwt = require('jsonwebtoken');
const { createUser, findUserByEmail, findUserById } = require('../repositories/authRepository');

const generateToken = (userId, isAdmin) => {
    return jwt.sign(
        { 
            userId: userId, 
            role: isAdmin ? 'admin' : 'user'
        }, 
        process.env.JWT_SECRET, 
        { expiresIn: '1h' }
    );
};

const processSignup = async (userData) => {
    if (!userData.email || !userData.password) {
        throw new Error('Email and password are required');
    }
    const existingUser = await findUserByEmail(userData.email);
    if (existingUser) {
        throw new Error('User already exists');
    }
    const newUser = await createUser(userData);
    const token = generateToken(newUser.id, newUser.isAdmin);

    return { 
        user: newUser,
        token 
    };
};

const processLogin = async (email, password) => {
    if (!email || !password) {
        throw new Error('Email and password are required');
    }
    const user = await findUserByEmail(email);
    if (!user) {
        throw new Error('User not found');
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        throw new Error('Invalid credentials');
    }
    const token = generateToken(user._id, user.isAdmin);

    return token;
};


const processGetUser = async (userId) => {
    if (!userId) {
        throw new Error('Invalid userId');
    }
    const user = await findUserById(userId);
    if (!user) {
        throw new Error('User not found');
    }
    return {
        id: user._id,
        email: user.email,
        isAdmin: user.isAdmin
    };
};



module.exports = {
    processSignup,
    processLogin,
    processGetUser
};