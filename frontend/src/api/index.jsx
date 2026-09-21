import axios from 'axios';

const URL_AUTH = import.meta.env.VITE_URL_AUTH;
const URL_DASHBOARD = import.meta.env.VITE_URL_DASHBOARD
const URL_SENSOR = import.meta.env.VITE_URL_SENSOR
const URL_GROUP = import.meta.env.VITE_URL_GROUP
// const URL_ALARM = import.meta.env.VITE_URL_ALARM
const URL_PRV_TIME = import.meta.env.VITE_URL_PRV_TIME
const URL_DMA = import.meta.env.VITE_URL_AUTH.replace('/api/auth', '/api/dma')
const URL_DNP_CONFIG = import.meta.env.VITE_URL_AUTH.replace('/api/auth', '/api/dnp-config')
const URL_GENERAL_SETTINGS = import.meta.env.VITE_URL_AUTH.replace('/api/auth', '/api/general-settings')
const URL_EXTERNAL_LOGGERS = import.meta.env.VITE_URL_AUTH.replace('/api/auth', '/api/external-loggers')
const URL_TRAFFIC = import.meta.env.VITE_URL_AUTH.replace('/api/auth', '/api/traffic')
const URL_CHATBOT = import.meta.env.VITE_URL_AUTH.replace('/api/auth', '/api/chatbot')
const URL_MAP_POINTS = import.meta.env.VITE_URL_AUTH.replace('/api/auth', '/api/map-points')

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

export const registerFcmTokenPost = (token, fcmToken) => {
    return axios.post(
        `${URL_AUTH}/fcm-token`,
        { token: fcmToken, platform: "web" },
        axiosConfig(token)
    )
}

export const unregisterFcmTokenDelete = (token, fcmToken) => {
    return axios.delete(
        `${URL_AUTH}/fcm-token`,
        {
            ...axiosConfig(token),
            data: { token: fcmToken },
        }
    )
}

export const sendFcmTestPost = (token, fcmToken) => {
    return axios.post(
        `${URL_AUTH}/fcm-test`,
        { token: fcmToken },
        axiosConfig(token)
    )
}

export const externalLoggerProvidersGet = (token) => {
    return axios.get(
        `${URL_EXTERNAL_LOGGERS}/providers`,
        axiosConfig(token)
    )
}

export const externalLoggerPointsGet = (token, provider, options = {}) => {
    return axios.get(
        `${URL_EXTERNAL_LOGGERS}/${encodeURIComponent(provider)}/points`,
        {
            ...axiosConfig(token),
            params: options,
        }
    )
}

export const externalLoggerDataGet = (token, provider, number, options) => {
    return axios.get(
        `${URL_EXTERNAL_LOGGERS}/${encodeURIComponent(provider)}/${encodeURIComponent(number)}/data`,
        {
            ...axiosConfig(token),
            params: options,
        }
    )
}

export const externalLoggerTokenRefreshPost = (token, provider) => {
    return axios.post(
        `${URL_EXTERNAL_LOGGERS}/${encodeURIComponent(provider)}/refresh-token`,
        {},
        axiosConfig(token)
    )
}

export const trafficHeartbeatPost = (token, sessionId, deviceType) => {
    return axios.post(
        `${URL_TRAFFIC}/heartbeat`,
        { sessionId, deviceType },
        axiosConfig(token)
    )
}

export const chatbotMessagePost = (token, options) => {
    return axios.post(
        `${URL_CHATBOT}/message`,
        options,
        axiosConfig(token)
    )
}

export const trafficStatsGet = (token) => {
    return axios.get(
        `${URL_TRAFFIC}/stats`,
        axiosConfig(token)
    )
}

export const getGroup = (token, user) => {
    return axios.get(
        `${URL_GROUP}?user=${encodeURIComponent(user)}`,
        axiosConfig(token)
    )
}

export const getGroupInfo = (token, user) => {
    return axios.get(
        `${URL_GROUP}/info?user=${encodeURIComponent(user)}`,
        axiosConfig(token)
    )
}

export const getSensorInGroup = (token, group) => {
    return axios.get(
        `${URL_GROUP}/group?${group}`,
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

export const updateSensorOrderPost = (token, data) => {
    return axios.post(
        `${URL_GROUP}/update-order`,
        data,
        axiosConfig(token)
    )
}

export const updateGroupOrderPost = (token, data) => {
    return axios.post(
        `${URL_GROUP}/update-group-order`,
        data,
        axiosConfig(token)
    )
}

// export const getAlarm = (token, sen_name) => {
//     return axios.post(
//         `${URL_ALARM}`,
//         sen_name,
//         axiosConfig(token)
//     )
// }

// export const addAlarm = (token, sen) => {
//     return axios.post(
//         `${URL_ALARM}/add`,
//         sen,
//         axiosConfig(token)
//     )
// }

// export const deleteAlarm = (token, sen) => {
//     return axios.post(
//         `${URL_ALARM}/delete`,
//         sen,
//         axiosConfig(token)
//     )
// }

export const getPrv = (token, prv_name) => {
    return axios.post(
        `${URL_PRV_TIME}`,
        prv_name,
        axiosConfig(token)
    )
}

export const getAllPrv = (token, user) => {
    return axios.get(
        `${URL_PRV_TIME}/get?user=${encodeURIComponent(user)}`,
        axiosConfig(token)
    )
}

export const changePrv = (token, prv_name) => {
    return axios.put(
        `${URL_PRV_TIME}/change`,
        prv_name,
        axiosConfig(token)
    )
}

export const addPrv_time = (token, prv_name) => {
    return axios.post(
        `${URL_PRV_TIME}/add`,
        prv_name,
        axiosConfig(token)
    )
}

export const deletePrv_time = (token, prv_name) => {
    return axios.delete(
        `${URL_PRV_TIME}/delete`,
        {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            data: prv_name
        }
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

export const loggerConfigStatusGet = (token, requestIdOrParams) => {
    const params = typeof requestIdOrParams === "object"
        ? requestIdOrParams
        : { requestId: requestIdOrParams };
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            query.set(key, value);
        }
    });

    return axios.get(
        `${URL_SENSOR}/data/config-status?${query.toString()}`,
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

export const sensorProductionPost = (token, options) => {
    return axios.post(
        `${URL_SENSOR}/production`,
        options,
        axiosConfig(token)
    );
}

export const warningHistoryTodayGet = (token, user, group = "", options = {}) => {
    const params = new URLSearchParams({
        user: String(user),
        limit: String(options.limit ?? 20),
        skip: String(options.skip ?? 0),
    });
    if (group) params.set("group", group);
    if (options.date) params.set("date", options.date);
    return axios.get(
        `${URL_SENSOR}/warning-history/today?${params.toString()}`,
        axiosConfig(token)
    );
}

export const homeMessagesGet = (token, user) => {
    const params = new URLSearchParams({ user: String(user) });
    return axios.get(
        `${URL_SENSOR}/home-messages?${params.toString()}`,
        axiosConfig(token)
    );
}

export const homeMessagePost = (token, message) => {
    return axios.post(
        `${URL_SENSOR}/home-messages`,
        message,
        axiosConfig(token)
    );
}

export const homeMessageDelete = (token, id) => {
    return axios.delete(
        `${URL_SENSOR}/home-messages/${id}`,
        axiosConfig(token)
    );
}

export const sensorReportPost = (token, options) => {
    return axios.post(
        `${URL_SENSOR}/report`,
        options,
        axiosConfig(token)
    );
}

// SSE qua fetch: axios khong doc duoc stream nen phai dung fetch truc tiep.
const postSseStream = async (url, token, body, { onDelta, onDone, signal } = {}) => {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal,
    });

    if (!response.ok || !response.body) {
        let payload = null;
        try {
            payload = await response.json();
        } catch {
            payload = null;
        }
        const error = new Error(payload?.error || `HTTP ${response.status}`);
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";
    let doneData = null;

    const handleEvent = (block) => {
        const lines = block.split("\n");
        const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() || "message";
        const data = lines.filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("");
        if (!data) return;

        let parsed;
        try {
            parsed = JSON.parse(data);
        } catch {
            return;
        }

        if (event === "delta" && parsed.text) {
            full += parsed.text;
            onDelta?.(parsed.text, full);
        } else if (event === "done") {
            doneData = parsed;
        } else if (event === "error") {
            const error = new Error(parsed.error || "AI khong phan hoi");
            error.status = parsed.statusCode;
            error.payload = parsed;
            throw error;
        }
    };

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
            handleEvent(buffer.slice(0, boundary));
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf("\n\n");
        }
    }

    onDone?.(full, doneData);
    return { text: full, ...doneData };
};

export const mapPointsGet = (token, params = {}) => {
    const query = new URLSearchParams(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
    ).toString();
    return axios.get(`${URL_MAP_POINTS}${query ? `?${query}` : ""}`, axiosConfig(token));
};

export const mapPointCreatePost = (token, point) => axios.post(
    URL_MAP_POINTS,
    point,
    axiosConfig(token)
);

export const mapPointUpdatePut = (token, id, point) => axios.put(
    `${URL_MAP_POINTS}/${id}`,
    point,
    axiosConfig(token)
);

export const mapPointDelete = (token, id, user) => axios.delete(
    `${URL_MAP_POINTS}/${id}?user=${encodeURIComponent(user)}`,
    axiosConfig(token)
);

export const mapPointHotspotsGet = (token, params = {}) => {
    const query = new URLSearchParams(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
    ).toString();
    return axios.get(`${URL_MAP_POINTS}/hotspots${query ? `?${query}` : ""}`, axiosConfig(token));
};

export const sensorReportAiAnalysisStream = (token, options, handlers) => postSseStream(
    `${URL_SENSOR}/report/ai-analysis/stream`,
    token,
    options,
    handlers
);

export const dmaAnalyzeStream = (token, options, handlers) => postSseStream(
    `${URL_DMA}/analyze/stream`,
    token,
    options,
    handlers
);

export const aiHealthGet = (token) => axios.get(
    `${import.meta.env.VITE_URL_AUTH.replace('/api/auth', '/api/ai')}/health`,
    axiosConfig(token)
);

export const sensorReportAiAnalysisPost = (token, options) => {
    return axios.post(
        `${URL_SENSOR}/report/ai-analysis`,
        options,
        axiosConfig(token)
    );
}

export const exportDailyReportPost = (token, options) => {
    return axios.post(
        `${URL_SENSOR}/report/daily-export`,
        options,
        {
            ...axiosConfig(token),
            responseType: "blob",
        }
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

const URL_UPLOAD = import.meta.env.VITE_URL_AUTH.replace('/api/auth', '/api/upload');

export const uploadLoggerImage = (token, sensorId, file, user) => {
    const formData = new FormData();
    formData.append('sensorId', sensorId);
    if (user !== undefined && user !== null) {
        formData.append('user', user);
    }
    formData.append('file', file);
    return axios.post(URL_UPLOAD, formData, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
        },
    });
};

export const getLoggerImageUrl = (sensorId, user, cacheKey) => {
    const params = new URLSearchParams();
    if (user !== undefined && user !== null) params.set('user', user);
    if (cacheKey !== undefined && cacheKey !== null) params.set('v', cacheKey);
    const query = params.toString();
    return `${URL_UPLOAD}/image/${sensorId}${query ? `?${query}` : ""}`;
};

export const dmaListGet = (token, user) => {
    return axios.get(
        `${URL_DMA}?user=${encodeURIComponent(user)}`,
        axiosConfig(token)
    );
};

export const dmaCreatePost = (token, dma) => {
    return axios.post(URL_DMA, dma, axiosConfig(token));
};

export const dmaUpdatePut = (token, id, dma) => {
    return axios.put(`${URL_DMA}/${id}`, dma, axiosConfig(token));
};

export const dmaDelete = (token, id, user) => {
    return axios.delete(
        `${URL_DMA}/${id}?user=${encodeURIComponent(user)}`,
        axiosConfig(token)
    );
};

export const dmaCalculatePost = (token, options) => {
    return axios.post(`${URL_DMA}/calculate`, options, axiosConfig(token));
};

export const dmaAnalyzePost = (token, options) => {
    return axios.post(`${URL_DMA}/analyze`, options, axiosConfig(token));
};

export const dnpConfigGet = (token, user) => {
    return axios.get(
        `${URL_DNP_CONFIG}?user=${encodeURIComponent(user)}`,
        axiosConfig(token)
    );
};

export const dnpConfigPut = (token, config) => {
    return axios.put(URL_DNP_CONFIG, config, axiosConfig(token));
};

export const generalSettingsGet = (token, user) => {
    return axios.get(
        `${URL_GENERAL_SETTINGS}?user=${encodeURIComponent(user)}`,
        axiosConfig(token)
    );
};

export const generalSettingsPut = (token, setting) => {
    return axios.put(URL_GENERAL_SETTINGS, setting, axiosConfig(token));
};
