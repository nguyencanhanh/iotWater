import User from '../models/User.js';
import Info from '../models/Info.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken'

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" })
    }
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Invalid Password" })
    }
    const token = jwt.sign({ _id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "10d" })

    return res.status(200).json({ success: true, token, user: { _id: user._id, name: user.name, role: user.role } })
  } catch (error) {
    console.log('login error', error)
    return res.status(500).json({ success: false, error: error.message })
  }
}

export const verify = (req, res) => {
  return res.status(200).json({ success: true, user: req.user })
}

export const info = async (req, res) => {
  try {
    const info = await Info.find()
    if (!info) {
      return res.status(404).json({ success: false, error: "Info not found" })
    }
    return res.status(200).json({ success: true, info })
  } catch (error) {
    console.log('info error', error)
    return res.status(500).json({ success: false, error: error.message })
  }
}

