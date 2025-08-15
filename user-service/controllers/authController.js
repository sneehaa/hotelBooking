const { 
    processSignup, 
    processLogin, 
    processGetUser 
} = require('../services/authService');

const handleSignup = async (req, res) => {
    try {
        const { user, token } = await processSignup(req.body);
        
        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                id: user.id,
                email: user.email,
                isAdmin: user.isAdmin
            },
            token
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const handleLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const token = await processLogin(email, password);
        
        res.status(200).json({
            success: true,
            token
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
};

const handleGetUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await processGetUser(id);
        
        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        res.status(error.message === 'User not found' ? 404 : 500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    handleSignup,
    handleLogin,
    handleGetUser
};