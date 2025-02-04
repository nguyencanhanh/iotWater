import Sensor from "../models/Sensor.js"
import Info from "../models/User.js";
import ExcelJS from 'exceljs';

function convertTime(timeConvert) {
  return timeConvert.getHours() * 60 + timeConvert.getMinutes()
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
    const { interval, tracking, trackingB, sample } = req.body;
    if (tracking) {
      const info = await Info.findOneAndUpdate({}, { $set: { tracking: tracking } }, { new: true })
      return res.status(200).json({ success: true, tracking })
    }
    if (trackingB) {
      const info = await Info.findOneAndUpdate({}, { $set: { trackingB: trackingB } }, { new: true })
      return res.status(200).json({ success: true, trackingB })
    }
    if (sample) {
      const info = await Info.findOneAndUpdate({}, { $set: { sample: sample } }, { new: true })
      return res.status(200).json({ success: true, sample })
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
    const timeTrackingRet = []
    if (profs.timeGet) {
      for (let i = 0; i < Number(profs.total); i++) {
        const sensor = await Sensor.find({
          index: i,
          createAt: { $gte: profs.timeGet[0].valueOf(), $lte: profs.timeGet[1].valueOf() }
        })
        const dataPressure = []
        sensor.forEach((sensor) => {
          const index = Math.floor(convertTime(sensor.createAt))
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
      const sensorT = Array(1440).fill(null)
      const sensorYRest = []
      const dataPressure = []
      let timeTracking = 0
      let currentStart = null;


      sensorY.forEach((sensor) => {
        const index = Math.floor(convertTime(sensor.createAt))
        sensorYRest[index] = sensor.Pressure
      })
      sensorN.forEach((sensor) => {
        if (profs.tracking) {
          if (sensor.Pressure > profs.tracking) {
            if (!currentStart) {
              currentStart = sensor.createAt
            }
          }
          else {
            if (currentStart) {
              timeTracking += Math.floor((sensor.createAt - currentStart) / 1000)
              currentStart = null;
            }
          }
          timeTrackingRet[i] = Math.round(timeTracking / 60)
        }
        const index = Math.floor(convertTime(sensor.createAt))
        sensorT[index] = sensor
        dataPressure[index] = sensor.Pressure
      })
      sensors[i] = { sensorYRest, sensorT, dataPressure }
    }
    return res.status(200).json({ success: true, sensors, timeTrackingRet })
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
