import axios from 'axios';
import { URL_AUTH, URL_DASHBOARD, URL_SENSOR } from '../utils/host';

export const verifyGet = (token) => {
    return axios.get(
        `${URL_AUTH}/verify`,
        { headers: { 'Authorization': `Bearer ${token}` } }
    )
}

export const loginPost = (user) => {
    return axios.post(`${URL_AUTH}/login`, user)
}


export const dashboardSummaryGet = (token) => {
    return axios.get(`${URL_DASHBOARD}/summary`,
        {
            headers: { 'Authorization': `Bearer ${token}` }
        }
    )
}

export const intervalUpdatePut = (token, interval) => {
    return axios.post(
        `${URL_SENSOR}/data/intervalUp`,
        interval,
        {
            headers: { Authorization: `Bearer ${token}` },
        }
    );
}

export const sensorListGet = (token, total) => {
    return axios.post(URL_SENSOR, total,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
}

export const sensorAddPost = (token, sensor) => {
    console.log(sensor)
    return axios.post(`${URL_SENSOR}/add`,
        sensor,
        {
            headers: { Authorization: `Bearer ${token}` },
        }
    );
}

export const sensorDelete = (token, id) => {
    return axios.delete(
        `${URL_SENSOR}/${id}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );
}

export const sensorUpdateGet = (token, id) => {
    return axios.get(`${URL_SENSOR}/data/${id}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
}

export const sensorUpdatePut = (token, id, sensor) => {
    return axios.put(
        `${URL_SENSOR}/data/${id}`,
        sensor,
        {
            headers: { Authorization: `Bearer ${token}` },
        }
    );
}

export const exportDataPost = (token, options) => {
    return axios.post(
        `${URL_SENSOR}/export`,
        options,
        {
            headers: { Authorization: `Bearer ${token}` },
        }
    );
}
