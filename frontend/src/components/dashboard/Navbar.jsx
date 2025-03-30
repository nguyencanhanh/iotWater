import { useAuth } from '../../context/authContext'

function Nav() {
    const { user, info, logout } = useAuth()
    return (
        <div className='flex items-center justify-between text-white h-12 bg-teal-600 px-5'>
            <p className="text-white ml-10">{user.name} </p>
            <img
                src="/img/logo.jpeg"
                alt="Logo"
                className="absolute top-0 left-0 w-12 h-12 rounded-full shadow-lg"
            />
            <div>Tổng số cảm biến: {info.length}</div>
            <button className='px-4 py-1 bg-teal-700 hover:bg-teal-800' onClick={() => logout()}>Logout</button>
        </div>
    )
}

export default Nav