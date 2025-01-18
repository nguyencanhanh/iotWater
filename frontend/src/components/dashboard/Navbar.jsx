import { useAuth } from '../../context/authContext'

function Nav() {
    const { user, logout } = useAuth()
    return (
        <div className='flex items-center justify-between text-white h-12 bg-teal-600 px-5'>
            <p className='text-white'>Welcome {user.name} </p>
            <button className='px-4 py-1 bg-teal-700 hover:bg-teal-800' onClick={() => logout()}>Logout</button>
        </div>
    )
}

export default Nav