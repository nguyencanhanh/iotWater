import PrvTime from "../models/PrvTime.js"
import PrvInfo from "../models/Prv.js"
import Prv from "../models/PrvData.js"
import { client } from "../mqtt/mqtt.js";
import PrvControl from "../models/PrvControl.js"

const dataType = {
    timeNextControl: 1,
    minSet: 2,
    maxSet: 3,
    mode: 6,
    low: 7,
    unit: 8,
    status: 9,
    minSetAM: 10,
    idMatch: 11,
    timeAlarm: 13,
    pConfig: 14,
    percent: 17,
    timeout1: 18,
    timeout2: 19,
    range: 20,
    time_top: 21,
    time_bot: 22,
    open1: 24,
    open2: 25,
    onOff: 26,
    flowClose: 27,
    flowOpen: 28,
    tFlowOpen: 29,
    tFlowClose: 30,
    temperature: 31,
    pBot: 33,
    timeoutO: 35,
    timeoutC: 36,
    dayMap: 37
};

const publishMessage = (type, id, data) => {
    client.publish(
        'prv/get',
        JSON.stringify({ n: id, m: type, d: data }),
        (error) => {
            if (error) {
                return false
            } else {
                return true
            }
        }
    )
}

function convertTime(timeConvert, watch) {
    return (timeConvert.getHours() * 60 + timeConvert.getMinutes()) * 60 / watch
}

function addDateElement(dataArray, sensor, index, type) {
    if (dataArray[index]) {
        dataArray[index] = (dataArray[index] + sensor[type]) / 2
    }
    else {
        dataArray[index] = sensor[type]
    }
}

export const getAllPrv = async (req, res) => {
    const { user } = req.query;
    try {
        const info_prv = await PrvInfo.find({ user: user }).select("id name");;
        return res.status(200).json({ success: true, info: info_prv });
    } catch (error) {
        return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
    }
}

export const getPrv = async (req, res) => {
    try {
        const prvDataP1 = []
        const prvDataP2 = []
        const prvDataP3 = []
        const prvDataF = []
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const { prv_name, user } = req.body
        const info_prv = await PrvInfo.findOne({ id: prv_name, user: user});
        const time = await PrvTime.find({ id: prv_name, user: user });
        const prvD = await Prv.find({
            index: prv_name,
            user: user,
            createAt: { $gte: startOfToday }
        });
        const control = await PrvControl.find({
            createAt: { $gte: startOfToday }
          }).sort({ createAt: -1 });
          
          // Gom theo id
          const grouped = control.reduce((acc, item) => {
            const key = item.id; // hoặc item.prv_name nếu field bạn dùng
            if (!acc[key]) {
              acc[key] = [];
            }
            acc[key].push(item);
            return acc;
          }, {});
        prvD.forEach((prv) => {
            const index = Math.floor(convertTime(prv.createAt, 60))
            addDateElement(prvDataP1, prv, index, "Pressure1");
            addDateElement(prvDataP2, prv, index, "Pressure2");
            addDateElement(prvDataP3, prv, index, "Pressure3");
            addDateElement(prvDataF, prv, index, "flow");
        })
        return res.status(200).json({ success: true, info: info_prv, control: grouped, time: time, prvDataP1: prvDataP1, prvDataP2: prvDataP2, prvDataP3: prvDataP3, prvDataF: prvDataF });
    } catch (error) {
        return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
    }
}

export const addPrvTime = async (req, res) => {
    try {
        const profs = req.body;
        const newPrvTime = new PrvTime({
            // user: profs.user,
            id: profs.prv_name,
            time: profs.time,
            minSetpoint: profs.minSetpoint,
            maxSetpoint: profs.maxSetpoint
        })
        await newPrvTime.save()
        //   fetchTimeAlarm(profs.user, profs.id)
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, error: "Alarm add failed due to some reason" });
    }
}

export const changePrv = async (req, res) => {
    try {
        const { info, field } = req.body;
        if (field === "rst") {
            if (publishMessage(11, info.id, info.id)) {
                return res.status(500).json({ success: false, error: "Not publish" })
            }
            return res.status(200).json({ success: true });
        }
        if (field === "init") {
            if (publishMessage(12, info.id, Math.floor(Date.now() / 1000))) {
                return res.status(500).json({ success: false, error: "Not publish" })
            }
            return res.status(200).json({ success: true });
        }
        let result = Number(info[field]);
        if (field === "range") {
            result = info[field].map((v) => `${Number(v) * 10}`).join(" ");
        }
        else if(field === "pConfig" || field === "pBot"){
            result = "";
            for(let i = 0; i < 7; i++){
                result += `${Number(info[field][info.index * 7 + i]) * 10} `;
            }
            result += info.index;
        }
        else if (field === "timeAlarm" || field === "onOff") {
            result = info[field].map((v) => `${Number(v)}`).join(" ");
        }
        else if (field === "time_top" || field === "time_bot" || field === "tFlowOpen" || field === "tFlowClose") {
            const [h, m] = info[field].split(':').map(Number);
            result = h * 60 + m
        }
        else if (field === "name") {
            await PrvInfo.findOneAndUpdate({ id: info.id }, { $set: { name: info.name } }, { new: true })
            return res.status(200).json({ success: true });
        }
        else if (field === "minSet" || field === "maxSet" || field === "minSetAM" || field === "flowClose" || field === "flowOpen") {
            result = Number(info[field]) * 10
        }
        else if (field === "open1" || field === "open2") {
            const [h1, m1] = info[field][0].split(':').map(Number);
            const [h2, m2] = info[field][1].split(':').map(Number);
            result = `${h1 * 60 + m1} ${h2 * 60 + m2} ${Number(info[field][2]) * 10}`
        }
        else if (field === "timeNextControl") {
            result = info[field] * 1000 - 10000;
        }
        else if (field === "timeout1" || field === "timeout2" || field === "timeoutO" || field === "timeoutC") {
            result = info[field] * 1000;
        }
        else if (field === "status") {
            if (publishMessage(dataType[field], info.id, info.cmd)) {
                return res.status(500).json({ success: false, error: "Not publish" })
            }
            return res.status(200).json({ success: true });
        }
        if (publishMessage(dataType[field], info.id, result)) {
            return res.status(500).json({ success: false, error: "Not publish" })
        }
        await PrvInfo.findOneAndUpdate({ id: info.id }, { $set: { [field]: info[field] } }, { new: true })
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, error: "Alarm add failed due to some reason" });
    }
}


export const deletePrvTime = async (req, res) => {
    const { user, prv_name, time } = req.body
    try {
        await PrvTime.deleteOne({ user: user, id: prv_name, time: time });
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, error: "Alarm add failed due to some reason" });
    }
}

