import Sensor from "../models/Sensor.js"
// import Info from "../models/User.js";
import InfoSen from "../models/Info.js";
import Group from "../models/Group.js";
import Flow from "../models/SumFlow.js";
import ExcelJS from 'exceljs';
import { client } from "../mqtt/mqtt.js";
import cron from 'node-cron'
import { differenceInCalendarDays } from 'date-fns'

const cronJobs = [];

const publishMessage = (key, message, sen_id) => {
  client.publish(
    'watter/setInterval',
    JSON.stringify({ [key]: message, sen_name: sen_id }),
    (error) => {
      if (error) {
        return false
      } else {
        return true
      }
    }
  )
}

const processJob = (sen_name, timeAlarm) => {
  cronJobs[sen_name] = []
  const startHour = Math.floor(timeAlarm / 60);  // Giờ bắt đầu
  const startMinute = timeAlarm % 60;  // Phút bắt đầu
  const duration = 20;  // Chạy trong 20 phút
  const interval = 2;  // Mỗi 2 phút

  const endMinute = startMinute + duration;
  const checkDate = (startHour + Math.floor(endMinute / 60))
  const endHour = checkDate > 23 ? 23 : checkDate;
  const adjustedEndMinute = checkDate > 23 ? 59 : endMinute % 60;

  // console.log(`Cron job sẽ chạy từ ${startHour}:${startMinute} đến ${endHour}:${adjustedEndMinute} mỗi ngày`);

  // Nếu chạy trong cùng 1 giờ
  if (startHour === endHour) {
    const cronExpression = `${startMinute}-${adjustedEndMinute}/${interval} ${startHour} * * *`;
    const job = cron.schedule(cronExpression, () => {
      // console.log(`Công việc chạy lúc: ${new Date().toLocaleTimeString()} ${sen_name}`);
      client.publish(
        'watter/setInterval',
        JSON.stringify({ sen_name: sen_name, req: 1 })
      )
    });
    cronJobs[sen_name].push(job)
  } else {
    // Chạy từ startMinute đến 59 của startHour
    const firstCronExpression = `${startMinute}-59/${interval} ${startHour} * * *`;
    const job1 = cron.schedule(firstCronExpression, () => {
      client.publish(
        'watter/setInterval',
        JSON.stringify({ sen_name: sen_name, req: 1 })
      )
      // console.log(`Công việc chạy lúc: ${new Date().toLocaleTimeString()} ${sen_name}`);
    });
    cronJobs[sen_name].push(job1)
    // Chạy từ 0 đến adjustedEndMinute của endHour
    const secondCronExpression = `0-${adjustedEndMinute}/${interval} ${endHour} * * *`;
    const job2 = cron.schedule(secondCronExpression, () => {
      client.publish(
        'watter/setInterval',
        JSON.stringify({ sen_name: sen_name, req: 1 })
      )
      // console.log(`Công việc chạy lúc: ${new Date().toLocaleTimeString()} ${sen_name}`);
    });
    cronJobs[sen_name].push(job2)
  }
}

export const Schedule = async () => {
  // const info = await InfoSen.find();
  // info.forEach(element => {
  //   processJob(element.id, element.timeAlarm)
  // });
};

function addDateElement(dataArray, sensor, index, type) {
  if (dataArray[index]) {
    dataArray[index] = (dataArray[index] + sensor[type]) / 2
  }
  else {
    dataArray[index] = sensor[type]
  }
}

function convertTime(timeConvert, watch) {
  return (timeConvert.getHours() * 60 + timeConvert.getMinutes()) * 60 / watch
}


function getDatesInRange(startDate, endDate) {
  const dateArray = [];
  let currentDate = new Date(startDate);

  while (differenceInCalendarDays(endDate, currentDate)) {
    dateArray.push(new Date(currentDate)); // YYYY-MM-DD
    currentDate.setDate(currentDate.getDate() + 1);
  }
  dateArray.push(endDate);
  return dateArray;
}

function getLength(lengModal, listDate) {
  const lengDate = listDate.length;
  if (lengDate !== 2) {
    return lengModal * lengDate - lengModal * 3 + (24 - listDate[0].getHours() + listDate[lengDate - 1].getHours()) * 12
  }
  else {
    return (listDate[lengDate - 1].getHours() - listDate[0].getHours()) * 12
  }
}

const formatDate = (dateString) => {
  const date = new Date(dateString);
  const datePart = date.toLocaleDateString("vi-VN"); // Định dạng dd/mm/yyyy
  const timePart = date.toLocaleTimeString("vi-VN", { hour12: false, hour: "2-digit", minute: "2-digit" }); // HH:MM

  return `${datePart} ${timePart}`; // Kết quả dạng "dd/mm/yyyy HH:MM"
};

const exportFakeDataToExcel = async (sensors, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sensors");

    worksheet.columns = [
      { header: "Thời gian", key: "createAt", width: 30 },
      { header: "Áp suất", key: "Pressure", width: 15 },
      { header: "Lưu lượng", key: "flow", width: 15 },
    ];

    sensors.forEach(sensor => {
      if (Math.floor(sensor.createAt / 60000) % 15) {
        return;
      }
      worksheet.addRow({
        createAt: formatDate(sensor.createAt),
        Pressure: sensor.Pressure?.toFixed(2),
        flow: sensor.flow,
      });
    });

    // ✅ Ghi dữ liệu vào buffer
    const excelBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(excelBuffer);

    // ✅ Đặt header chính xác
    res.setHeader("Content-Disposition", 'attachment; filename="export.xlsx"');
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    res.send(buffer); // ⚡ Đúng cách truyền file binary
  } catch (error) {
    console.error("❌ Lỗi server khi xuất Excel:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};


export const exportSensors = async (req, res) => {
  try {
    const { sen_name, date, user } = req.body;
    const startOfToday = new Date(date[0]);
    const endOfToday = new Date(date[1]);
    startOfToday.setUTCMinutes(0, 0, 0);
    endOfToday.setUTCMinutes(0, 0, 999);
    const sensorData = await Sensor.find({
      index: sen_name,
      user: user,
      createAt: { $gte: startOfToday, $lte: endOfToday }
    }).sort({ createAt: 1 });
    return exportFakeDataToExcel(sensorData, res);
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: "Add Sensor server error." });
    }
  }
};

export const upInterval = async (req, res) => {
  const profs = req.body;
  try {
    if (profs.Coor != null) {
      const updateCoor = await InfoSen.findOneAndUpdate({ id: profs.Coor, user: profs.user },
        {
          $set: {
            lat: parseFloat(profs.lat),
            lng: parseFloat(profs.lng)
          }
        },
        { new: true }
      )
      return res.status(200).json({ success: true })
    }
    if(profs.sum != null){
      const info = await Flow.findOneAndUpdate({ sen_name: profs.sen_id, user: profs.user }, { $set: { sum: profs.sum } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.adj != null) {
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { adj: profs.adj } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.wPressTime != null) {
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { wPressTime: profs.wPressTime } }, { new: true })
      if (profs.wPressTime < 0) {
        // cronJobs[profs.sen_id].forEach(job => job.stop());
        cronJobs[profs.sen_id] = [];
      }
      else if (cronJobs[profs.sen_id].length === 0) {
        // processJob(profs.sen_id, profs.timeAlarm);
      }
      return res.status(200).json({ success: true })
    }
    if (profs.timeAlarm != null) {
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { timeAlarm: profs.timeAlarm } }, { new: true })
      cronJobs[profs.sen_id].forEach(job => job.stop());
      cronJobs[profs.sen_id] = [];
      if (profs.press > 0) {
        // processJob(profs.sen_id, profs.timeAlarm);
      }
      return res.status(200).json({ success: true })
    }
    if (profs.watch != null) {
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { watch: profs.watch } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.wPress != null) {
      const inputPress = profs.wPress < 0 ? 0 : Number(profs.wPress).toFixed(2) * 100;
      if (publishMessage('wPress', inputPress, profs.sen_id)) {
        return res.status(500).json({ success: false, error: "Not publish" })
      }
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { wPress: profs.wPress } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.tracking != null) {
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { tracking: profs.tracking } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.temp != null) {
      const inputTemp = profs.temp < 0 ? 100 : Math.floor(Number(profs.temp));
      if (publishMessage('temp', inputTemp, profs.sen_id)) {
        return res.status(500).json({ success: false, error: "Not publish" })
      }
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { temperature: profs.temp } }, { new: true })
      return res.status(200).json({ success: true })
    }
    if (profs.sample != null) {
      if (publishMessage('sample', profs.sample, profs.sen_id)) {
        return res.status(500).json({ success: false, error: "Not publish" })
      }
      const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { sample: profs.sample } }, { new: true })
      return res.status(200).json({ success: true, sample: info.sample })
    }
    if (publishMessage('interval', profs.interval, profs.sen_id)) {
      return res.status(500).json({ success: false, error: "Not publish" })
    }
    const info = await InfoSen.findOneAndUpdate({ id: profs.sen_id, user: profs.user }, { $set: { interval: profs.interval } }, { new: true })
    return res.status(200).json({ success: true, interval: info.interval })
  } catch (error) {
    return res.status(500).json({ success: false, error: "Sensor not found" })
  }
}

export const getSensors = async (req, res) => {
  try {
    const profs = req.body;
    const sensors = []
    const timeTrackingRet = []
    const temperature = []
    const battery = []
    const pram = []
    const pramFlow = []
    if (profs.totalMap) {
      for (let i = 0; i < Number(profs.totalMap); i++) {
        const sensor = await Sensor.findOne({ index: i, user: profs.user }).sort({ $natural: -1 });
        sensors[i] = sensor
      }
      return res.status(200).json({ success: true, sensors })
    }
    if (profs.timeGet) {
      const lengModal = 288
      const startOfToday = new Date(profs.timeGet[0]);
      const endOfToday = new Date(profs.timeGet[1]);
      startOfToday.setDate(startOfToday.getDate() - 1);
      startOfToday.setUTCMinutes(0, 0, 0);
      endOfToday.setUTCMinutes(0, 0, 999);
      const sensorData = await Sensor.find({
        index: profs.sen_name,
        user: profs.user,
        createAt: { $gte: startOfToday, $lte: endOfToday }
      }).sort({ createAt: 1 });
      const listDate = getDatesInRange(startOfToday, endOfToday);
      const lengArray = getLength(lengModal, listDate)
      const sensorH = []
      const sensorY = []
      const flowH = []
      const flowY = []
      const sensorT = Array(lengArray).fill(null)
      const startDate = startOfToday
      const offSetHour = listDate[0].getHours() * 12
      sensorData.forEach((sensor, step) => {
        const dateOfSensor = new Date(sensor.createAt)
        const currentDate = dateOfSensor
        const convert = differenceInCalendarDays(currentDate, startDate)
        const convertTimeValue = Math.floor(convertTime(sensor.createAt, 300))
        let index = convert * lengModal + convertTimeValue - offSetHour;
        if (index < lengArray) {
          addDateElement(sensorY, sensor, index, "Pressure")
          addDateElement(flowY, sensor, index, "flow")
        }
        if (index >= lengModal) {
          index = index - lengModal
          addDateElement(sensorH, sensor, index, "Pressure")
          addDateElement(flowH, sensor, index, "flow")
        }
      })
      return res.status(200).json({ success: true, sensorH, sensorY, flowH, flowY, sensorT })
    }
    const startOfToday = new Date();
    const yesterday = new Date(startOfToday);
    yesterday.setDate(startOfToday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    startOfToday.setHours(0, 0, 0, 0);
    for (let i = 0; i < Number(profs.total); i++) {
      timeTrackingRet[i] = 0;
      const flowSum = await Flow.findOne({
        sen_name: profs.info[i].id,
        user: profs.user,
      }).select('sum -_id').lean();
      const sensorY = await Sensor.find({
        index: profs.info[i].id,
        user: profs.user,
        createAt: { $gte: yesterday, $lt: startOfToday },
      }).sort({ createAt: 1 });
      const sensorN = await Sensor.find({
        index: profs.info[i].id,
        user: profs.user,
        createAt: { $gte: startOfToday },
      }).sort({ createAt: 1 });
      const sensorT = Array(86400 / profs.info[i].watch).fill(null)
      const sensorYRest = []
      const flowYRest = []
      const dataPressure = []
      const dataFlow = []
      let timeTracking = 0
      let currentStart = 0;
      let maxPress = 0;
      let minPress = 70;
      let avgPress = 0;
      const pFlow = {
        max: 0,
        min: 1000,
        avg: 0,
        sum: flowSum.sum,
        count: 0
      }

      sensorY.forEach((sensor) => {
        const index = Math.floor(convertTime(sensor.createAt, profs.info[i].watch))
        sensorYRest[index] = sensor.Pressure
        flowYRest[index] = sensor.flow
      })
      sensorN.forEach((sensor) => {
        maxPress = Math.max(sensor.Pressure, maxPress);
        minPress = Math.min(sensor.Pressure, minPress);
        avgPress += sensor.Pressure;
        if(sensor.flow){
          pFlow.max = Math.max(sensor.flow, pFlow.max);
          pFlow.min = Math.min(sensor.flow, pFlow.min);
          pFlow.avg += sensor.flow;
          pFlow.count++
        }
        if (profs.info) {
          if (sensor.Pressure >= profs.info[i].tracking) {
            const timeAdd = Math.floor((sensor.createAt - currentStart) / 1000)
            if (timeAdd < 1000) {
              timeTracking += timeAdd
            }
          }
        }
        currentStart = sensor.createAt
        const index = Math.floor(convertTime(sensor.createAt, profs.info[i].watch))
        addDateElement(dataPressure, sensor, index, "Pressure")
        addDateElement(dataFlow, sensor, index, "flow")
        sensorT[index] = sensor
      })
      if (sensorN.length !== 0) {
        battery[i] = sensorN[sensorN.length - 1].battery
        temperature[i] = sensorN[sensorN.length - 1].temperature || 25
      }
      timeTrackingRet[i] = Math.round(timeTracking / 60)
      if (minPress === 70) minPress = 0;
      if(pFlow.min === 1000) pFlow.min = 0;
      pram[i] = { max: maxPress, min: minPress, avg: avgPress / sensorN.length }
      pramFlow[i] = { ...pFlow, avg: pFlow.avg / pFlow.count};
      sensors[i] = { sensorYRest, flowYRest, dataFlow, sensorT, dataPressure }
    }
    return res.status(200).json({ success: true, sensors, timeTrackingRet, battery, temperature, pram, pramFlow })
  } catch (error) {
    return res.status(500).json({ success: false, error: "Sensor not found" })
  }
}

export const addSensor = async (req, res) => {
  try {
    const { sen_name, description, id } = req.body;

    if (!sen_name || !description) {
      return res.status(400).json({ success: false, error: "All fields are required." });
    }
    const newSen = new InfoSen({
      tracking: 1.5,
      interval: 60,
      wPress: 0.8,
      wPressTime: 1.2,
      timeAlarm: 300,
      watch: 60,
      adj: 0,
      id: id,
      name: sen_name,
      lat: 105,
      lng: 21,
      sample: 60,
      description: description,
      temperature: 30,
    })
    await newSen.save()
    return res.status(201).json({ success: true, message: "Sensor added successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Add Sensor server error." });
  }
};


export const viewSensor = async (req, res) => {
  try {
    const { id } = req.body;
    const sensor = await InfoSen.findOne({ id: id });
    return res.status(200).json({ success: true, sensor });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Sensor not found" })
  }
}


export const updateSensor = async (req, res) => {
  try {
    const { sen_name, sen_description, id } = req.body;
    const updateSensor = await InfoSen.findOneAndUpdate(
      { id: id },
      {
        $set: {
          description: sen_description,
          name: sen_name // Thêm name vào đây
        }
      },
      { new: true }
    );
    return res.status(200).json({ success: true, message: "Edit data successfully." })
  } catch (error) {
    return res.status(500).json({ success: false, error: "Sensor edit Failed due to some Reason " })
  }
}

export const getGroup = async (req, res) => {
  try {
    const { user } = req.body;
    const sen_group = []
    const group = []
    const Groups = await Group.find({ user: user });
    const senGroup = await InfoSen.find({ user: user });
    Groups.forEach((sensor) => {
      group.push(sensor.name)
    })
    senGroup.forEach((sensor) => {
      sen_group.push({ group: sensor.group, name: sensor.name })
    })
    return res.status(200).json({ success: true, group, sen_group });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}

export const getSensorInGroup = async (req, res) => {
  try {
    const { group, user } = req.body
    const senInGroup = group !== "Khong co" ? await InfoSen.find({ group: group, user: user }) : await InfoSen.find({ group: { $exists: false }, user: user });
    return res.status(200).json({ success: true, senInGroup });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}

export const getGroupInfo = async (req, res) => {
  try {
    const { user } = req.body
    const data = {}
    const valueSenS = []
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const senGroup = await InfoSen.find({ user: user });
    for (let i = 0; i < senGroup.length; i++) {
      const valueSen = await Sensor.findOne({ index: i, user: user, createAt: { $gte: startOfToday } }).sort({ createAt: -1 });
      valueSenS[i] = valueSen
    }
    senGroup.forEach((sensor) => {
      if (!sensor.group || sensor.group === "") sensor.group = "Khong co"
      if (!data[sensor.group]) data[sensor.group] = []
      data[sensor.group].push(sensor)
    })
    return res.status(200).json({ success: true, data, valueSenS });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}

export const changeGroup = async (req, res) => {
  try {
    const profs = req.body;
    if (profs.newGroup === "Khong co") {
      const updateSensor = await InfoSen.findOneAndUpdate(
        { name: profs.name, user: profs.user },
        { $unset: { group: "" } }
      );
      return res.status(200).json({ success: true });
    }
    const updateSensor = await InfoSen.findOneAndUpdate(
      { name: profs.name, user: profs.user },
      {
        $set: {
          group: profs.newGroup // Thêm name vào đây
        }
      },
      { new: true }
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}

export const deleteGroup = async (req, res) => {
  try {
    const profs = req.body;
    const delGroup = await Group.deleteOne({ name: profs.groupToRemove, user: profs.user })
    const deleteGroup = await InfoSen.updateMany({ group: profs.groupToRemove, user: profs.user }, { $unset: { group: "" } })
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}

export const addGroup = async (req, res) => {
  try {
    const profs = req.body;
    const newGroup = new Group({
      name: profs.newGroup,
      user: profs.user
    })
    await newGroup.save()
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Group get failed due to some reason" });
  }
}
