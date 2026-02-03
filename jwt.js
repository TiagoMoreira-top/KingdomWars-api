const jwt = require('jsonwebtoken')
require("dotenv").config();

exports.generateToken = (data, callback) => {
    let expiresIn = data.expires_in || '30d';
    let token = jwt.sign({
        data: data,
    }, process.env.TOKEN_SECRET, {expiresIn: expiresIn});
    return callback(token); 
}


exports.validateToken = (token, callback) => {
    if (!token)
        return callback(false)

    let realToken = token;

    realToken = token.replace('Bearer ', '')

    jwt.verify(realToken, process.env.TOKEN_SECRET, function(error, decoded) {
        if (error) {
            return callback(false);
        } else {
            return callback(true, decoded.data)
        }
    })
}