const User = require('../models/userModel');
const bcrypt = require('bcrypt');

const createUser = async (userData) => {
    try {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        
        const newUser = new User({
            email: userData.email,
            password: hashedPassword,
            isAdmin: userData.isAdmin || false
        });

        const savedUser = await newUser.save();
        return {
            id: savedUser._id,
            email: savedUser.email,
            isAdmin: savedUser.isAdmin
        };
    } catch (error) {
        throw error;
    }
};

const findUserByEmail = async (email) => {
    try {
        return await User.findOne({ email }).select('+password');
    } catch (error) {
        throw error;
    }
};

const findUserById = async (userId) => {
    try {
        return await User.findById(userId).select('email isAdmin');
    } catch (error) {
        throw error;
    }
};

module.exports = {
    createUser,
    findUserByEmail,
    findUserById
};