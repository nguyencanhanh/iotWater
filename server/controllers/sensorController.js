import Sensor from "../models/Sensor.js"
import Info from "../models/User.js";
import ExcelJS from 'exceljs';

function convertTime(timeConvert) {
  return timeConvert.getHours() * 3600 + timeConvert.getMinutes() * 60 + timeConvert.getSeconds()
}

const exportFakeDataToExcel = async (sensors, info) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sensors');
    worksheet.columns = [
      { header: 'Sensor Name', key: 'sen_name', width: 30 },
      { header: 'Pressure', key: 'Pressure', width: 15 },
      { header: 'Created At', key: 'createAt', width: 30 },
    ];

    sensors.forEach(sensor => {
      worksheet.addRow({
        sen_name: info.sen_id[sensor.index],
        Pressure: sensor.Pressure,
        createAt: sensor.createAt.toISOString(),
      });
    });

    const filePath = './dataExport/fake_sensors.xlsx';
    await workbook.xlsx.writeFile(filePath);

  } catch (error) {
    console.error('Error exporting fake data to Excel:', error);
  }
};

export const exportSensors = async (req, res) => {
  try {
    const { type } = req.body;
    const pastTime = Date.now() - Number(type) * 60 * 1000
    const allData = await Sensor.find(
      {
        createAt: { $gte: pastTime }
      }
    )

    const info = await Info.findOne({})
    exportFakeDataToExcel(allData, info)
    return res.status(201).json({ success: true, message: "Sensor added successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Add Sensor server error." });
  }
};

export const upInterval = async (req, res) => {
  try {
    const { interval, tracking, trackingB } = req.body;
    if (tracking) {
      console.log(tracking)
      const info = await Info.findOneAndUpdate({}, { $set: { tracking: tracking } }, { new: true })
      return res.status(200).json({ success: true, tracking })
    }
    if (trackingB) {
      console.log(tracking)
      const info = await Info.findOneAndUpdate({}, { $set: { trackingB: trackingB } }, { new: true })
      return res.status(200).json({ success: true, trackingB })
    }
    const info = await Info.findOneAndUpdate({}, { $set: { interval: interval } }, { new: true })
    return res.status(200).json({ success: true, interval })
  } catch (error) {
    return res.status(500).json({ success: false, error: "Sensor not found" })
  }
}

export const getSensors = async (req, res) => {
  try {
    const profs = req.body;
    const sensors = []
    let timeTracking = 0
    if (profs.timeGet) {
      for (let i = 0; i < Number(profs.total); i++) {
        const sensor = await Sensor.find({
          index: i,
          createAt: { $gte: profs.timeGet[0].valueOf(), $lte: profs.timeGet[1].valueOf() }
        })
        const dataPressure = []
        sensor.forEach((sensor) => {
          const index = Math.floor(convertTime(sensor.createAt) / (profs.interval ? profs.interval : 15))
          if (dataPressure[index]) {
            dataPressure[index] = (dataPressure[index] + sensor.Pressure) / 2
          }
          else {
            dataPressure[index] = sensor.Pressure
          }
        })
        sensors[i] = { sensor, dataPressure }
      }
      return res.status(200).json({ success: true, sensors })
    }
    const startOfToday = new Date();
    const yesterday = new Date(startOfToday);
    yesterday.setDate(startOfToday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    startOfToday.setHours(0, 0, 0, 0);
    for (let i = 0; i < Number(profs.total); i++) {
      const sensorY = await Sensor.find({
        index: i,
        createAt: { $gte: yesterday, $lte: startOfToday },
      });
      const sensorN = await Sensor.find({
        index: i,
        createAt: { $gte: startOfToday },
      });
      const sensorT = await Sensor.find({
        index: i,
      });
      const sensorYRest = []
      const dataPressure = []
      sensorY.forEach((sensor) => {
        const index = Math.floor(convertTime(sensor.createAt) / (profs.interval ? profs.interval : 15))
        if (sensorYRest[index]) {
          sensorYRest[index] = (sensorYRest[index] + sensor.Pressure) / 2
        }
        else {
          sensorYRest[index] = sensor.Pressure
        }
        sensorYRest[index].toFixed(1)
      })
      sensorN.forEach((sensor, step) => {
        if(step > 0){
          timeTracking += sensor.createAt - sensorN[index - 1].createAt
          console.log(timeTracking)
        }
        const index = Math.floor(convertTime(sensor.createAt) / (profs.interval ? profs.interval : 15))
        if (dataPressure[index]) {
          dataPressure[index] = (dataPressure[index] + sensor.Pressure) / 2
        }
        else {
          dataPressure[index] = sensor.Pressure
        }
        dataPressure[index].toFixed(1)
      })
      sensors[i] = { sensorYRest, sensorT, dataPressure }
    }
    return res.status(200).json({ success: true, sensors })
  } catch (error) {
    return res.status(500).json({ success: false, error: "Sensor not found" })
  }
}

export const addSensor = async (req, res) => {
  try {
    const { sen_name, description } = req.body;

    if (!sen_name || !description) {
      return res.status(400).json({ success: false, error: "All fields are required." });
    }
    const infoName = await Info.findOne({});
    const info = await Info.findOneAndUpdate({},
      {
        $push: {
          sen_id: { name: sen_name, id: infoName.total }
        },
        $inc: { total: 1 },
      },
      { new: true }
    );
    return res.status(201).json({ success: true, message: "Sensor added successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Add Sensor server error." });
  }
};


export const viewSensor = async (req, res) => {
  try {
    const { id } = req.params;
    const sensor = await Info.findOne({});
    return res.status(200).json({ success: true, sensor: sensor.sen_id[id] });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Sensor not found" })
  }
}


export const updateSensor = async (req, res) => {
  try {
    const { id } = req.params
    const { sen_name } = req.body;
    const updateSen = await Info.findOneAndUpdate({},
      { $set: { [`sen_id.${id}`]: { name: sen_name, id: id } } },
      { new: true }
    )
    return res.status(200).json({ success: true, message: "Edit data successfully." })
  } catch (error) {
    return res.status(500).json({ success: false, error: "Sensor edit Failed due to some Reason " })
  }
}


export const deleteSensor = async (req, res) => {
  try {
    const { id } = req.params;
    const deleteSen = await Sensor.findById(id); // Directly pass id
    await Sensor.deleteOne()

    if (!deleteSen) {
      return res.status(404).json({ success: false, error: "Sensor not found" });
    }

    return res.status(200).json({ success: true, deleteSen });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Sensor delete failed due to some reason" });
  }
};
