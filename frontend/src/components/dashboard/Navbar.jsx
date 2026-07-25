import { useAuth } from '../../context/authContext'
import { useState, useEffect } from 'react';
import { setupForegroundNotificationListener } from '../../utils/fcm';

export let dataSensorGroup = null;

function Nav() {
    const { user, info, logout } = useAuth();
    const [pushStatus, setPushStatus] = useState(
        localStorage.getItem("fcmRegistered") === "true" ? "enabled" : "idle"
    );
    // const [dataSensorOnline, setDataSensorOnline] = useState(0);
    // useEffect(async () => {
    //     try {
    //         const res = await getGroupInfo(localStorage.getItem("token"), user.user);
    //         if (res.data.success) {
    //             setDataSensorOnline(res.data.dataSensorOnline);
    //             dataSensorGroup = res.data;
    //         }
    //     } catch (e) {
    //         console.error(e);
    //     }
    // }, []);
    useEffect(() => {
        const syncPushStatus = () => {
            setPushStatus(localStorage.getItem("fcmRegistered") === "true" ? "enabled" : "idle");
        };
        window.addEventListener("fcm-status-change", syncPushStatus);
        window.addEventListener("storage", syncPushStatus);
        return () => {
            window.removeEventListener("fcm-status-change", syncPushStatus);
            window.removeEventListener("storage", syncPushStatus);
        };
    }, []);

    useEffect(() => {
        if (pushStatus !== "enabled") return;
        let unsubscribe = () => {};
        setupForegroundNotificationListener()
            .then((cleanup) => {
                unsubscribe = cleanup;
            })
            .catch((error) => console.error("Không bật được foreground FCM:", error));
        return () => unsubscribe();
    }, [pushStatus]);

    return (
        <div className='sticky top-0 z-40 flex h-12 items-center justify-between bg-teal-600 px-4 text-white shadow-sm'>
            <div className="flex min-w-0 items-center gap-3">
                <img
                    src="/img/logo.jpeg"
                    alt="Logo"
                    className="h-10 w-10 shrink-0 rounded-full shadow-lg"
                />
                <p className="truncate text-white">{user.name}</p>
            </div>
            <div className="text-center text-sm font-medium">Tổng số cảm biến: {info?.length}</div>
            <div className="flex items-center gap-2">
                <button className='rounded bg-teal-700 px-4 py-1 hover:bg-teal-800' onClick={() => logout()}>Logout</button>
            </div>
        </div>
    )
}

export default Nav
