import axios from 'axios';

const URL_AUTH = import.meta.env.VITE_URL_AUTH;
const URL_DASHBOARD = import.meta.env.VITE_URL_DASHBOARD
const URL_SENSOR = import.meta.env.VITE_URL_SENSOR
const URL_GROUP = import.meta.env.VITE_URL_GROUP
const URL_ALARM = import.meta.env.VITE_URL_ALARM

const axiosConfig = (token) => ({
    headers: {
        'Authorization': `Bearer ${token}`,
    }
});

export const verifyGet = (token) => {
    return axios.get(
        `${URL_AUTH}/verify`,
        axiosConfig(token)
    )
}

export const loginPost = (user) => {
    return axios.post(`${URL_AUTH}/login`, user)
}

export const infoGet = (token) => {
    return axios.get(
        `${URL_AUTH}/info`,
        axiosConfig(token)
    )
}

export const getGroup = (token, user) => {
    return axios.post(
        `${URL_GROUP}`,
        user,
        axiosConfig(token)
    )
}

export const getGroupInfo = (token, user) => {
    return axios.post(
        `${URL_GROUP}/info`,
        user,
        axiosConfig(token)
    )
}

export const getSensorInGroup = (token, group) => {
    return axios.post(
        `${URL_GROUP}/group`,
        group,
        axiosConfig(token)
    )
}

export const changeGroup = (token, sen) => {
    return axios.put(
        `${URL_GROUP}/change`,
        sen,
        axiosConfig(token)
    )
}

export const addGroup = (token, sen) => {
    return axios.post(
        `${URL_GROUP}/add`,
        sen,
        axiosConfig(token)
    )
}

export const deleteGroup = (token, sen) => {
    return axios.post(
        `${URL_GROUP}/delete`,
        sen,
        axiosConfig(token)
    )
}

export const getAlarm = (token, sen_name) => {
    return axios.post(
        `${URL_ALARM}`,
        sen_name,
        axiosConfig(token)
    )
}

export const addAlarm = (token, sen) => {
    return axios.post(
        `${URL_ALARM}/add`,
        sen,
        axiosConfig(token)
    )
}

export const deleteAlarm = (token, sen) => {
    return axios.post(
        `${URL_ALARM}/delete`,
        sen,
        axiosConfig(token)
    )
}


export const dashboardSummaryGet = (token) => {
    return axios.get(`${URL_DASHBOARD}/summary`,
        axiosConfig(token)
    )
}

export const intervalUpdatePut = (token, interval) => {
    return axios.post(
        `${URL_SENSOR}/data/intervalUp`,
        interval,
        axiosConfig(token)
    );
}

export const sensorListGet = (token, total) => {
    return axios.post(URL_SENSOR, total,
        axiosConfig(token)
    );
}

export const sensorAddPost = (token, sensor) => {
    return axios.post(`${URL_SENSOR}/add`,
        sensor,
        axiosConfig(token)
    );
}

export const sensorDelete = (token, id) => {
    return axios.delete(
        `${URL_SENSOR}/${id}`,
        axiosConfig(token)
    );
}

export const sensorUpdateGet = (token, id) => {
    return axios.post(`${URL_SENSOR}/viewSen`,id ,axiosConfig(token));
}

export const sensorUpdatePut = (token, sensor) => {
    return axios.post(
        `${URL_SENSOR}/updateSen`,
        sensor,
        axiosConfig(token)
    );
}

export const exportDataPost = (token, options) => {
    return axios.post(
        `${URL_SENSOR}/export`,
        options,
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json', // ✅ Đảm bảo gửi đúng format
            },
            responseType: "blob" // ✅ Quan trọng để nhận file Excel
        }
    );
};

