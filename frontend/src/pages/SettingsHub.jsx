import React, { useEffect, useState } from "react";
import { FaBell, FaBellSlash, FaLayerGroup, FaMapMarkedAlt, FaPaperPlane, FaSave, FaTint, FaTools } from "react-icons/fa";
import GroupNameTable from "../components/setting/SettingGroup";
import DnpSetting from "./DnpSetting";
import { registerWebPushNotifications, unregisterWebPushNotifications } from "../utils/fcm";
import { generalSettingsGet, generalSettingsPut } from "../api";
import { useAuth } from "../context/authContext";

const DEFAULT_MAP_TOOLTIP_MIN_ZOOM = 15;

const tabs = [
  {
    key: "groups",
    label: "Đổi nhóm",
    icon: <FaLayerGroup />,
    description: "Tạo nhóm và chuyển logger giữa các nhóm.",
  },
  {
    key: "dnp",
    label: "DNP",
    icon: <FaTint />,
    description: "Chọn logger dùng để tính sheet bình quân nước DNP.",
  },
  {
    key: "notifications",
    label: "Cài đặt chung",
    icon: <FaBell />,
    description: "Thông báo và hiển thị bản đồ.",
  },
];

const getSavedTab = () => {
  if (typeof window === "undefined") return "groups";
  return localStorage.getItem("settingsHubTab") || "groups";
};

const notifyPushStatusChanged = () => {
  window.dispatchEvent(new Event("fcm-status-change"));
};

const GeneralSettings = () => {
  const { user } = useAuth();
  const currentUser = Number.isFinite(Number(user?.user)) ? Number(user.user) : 0;
  const [pushStatus, setPushStatus] = useState(
    localStorage.getItem("fcmRegistered") === "true" ? "enabled" : "idle"
  );
  const [message, setMessage] = useState("");
  const [mapTooltipMinZoom, setMapTooltipMinZoom] = useState(DEFAULT_MAP_TOOLTIP_MIN_ZOOM);
  const [settingMessage, setSettingMessage] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const isEnabled = pushStatus === "enabled";
  const isLoading = pushStatus === "loading";
  const permission = typeof Notification !== "undefined" ? Notification.permission : "unsupported";

  useEffect(() => {
    let canceled = false;
    const fetchGeneralSettings = async () => {
      setSettingsLoading(true);
      try {
        const res = await generalSettingsGet(localStorage.getItem("token"), currentUser);
        if (!canceled && res.data.success) {
          setMapTooltipMinZoom(Number(res.data.setting?.mapTooltipMinZoom) || DEFAULT_MAP_TOOLTIP_MIN_ZOOM);
        }
      } catch (error) {
        if (!canceled) {
          setSettingMessage(error.response?.data?.error || "Không tải được cài đặt chung");
        }
      } finally {
        if (!canceled) setSettingsLoading(false);
      }
    };

    fetchGeneralSettings();
    return () => {
      canceled = true;
    };
  }, [currentUser]);

  const handleEnablePush = async () => {
    try {
      setPushStatus("loading");
      setMessage("");
      await registerWebPushNotifications();
      localStorage.setItem("fcmRegistered", "true");
      setPushStatus("enabled");
      notifyPushStatusChanged();
      setMessage("Đã bật thông báo trên thiết bị này");
    } catch (error) {
      setPushStatus("idle");
      notifyPushStatusChanged();
      setMessage(error?.message || "Không bật được thông báo");
    }
  };

  const handleDisablePush = async () => {
    try {
      setPushStatus("loading");
      setMessage("");
      await unregisterWebPushNotifications();
      setPushStatus("idle");
      notifyPushStatusChanged();
      setMessage("Đã tắt thông báo trên thiết bị này");
    } catch (error) {
      setPushStatus("enabled");
      notifyPushStatusChanged();
      setMessage(error?.message || "Không tắt được thông báo");
    }
  };

  const handleSaveGeneralSettings = async () => {
    const zoom = Number(mapTooltipMinZoom);
    if (!Number.isFinite(zoom) || zoom < 1 || zoom > 22) {
      setSettingMessage("Ngưỡng zoom phải từ 1 đến 22");
      return;
    }

    setSettingsSaving(true);
    setSettingMessage("");
    try {
      const res = await generalSettingsPut(localStorage.getItem("token"), {
        user: currentUser,
        mapTooltipMinZoom: zoom,
      });
      if (res.data.success) {
        setMapTooltipMinZoom(Number(res.data.setting?.mapTooltipMinZoom) || DEFAULT_MAP_TOOLTIP_MIN_ZOOM);
        setSettingMessage("Đã lưu cài đặt chung");
      }
    } catch (error) {
      setSettingMessage(error.response?.data?.error || "Không lưu được cài đặt chung");
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-white bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-black text-slate-900">Thông báo</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Dùng để bật/tắt nhận cảnh báo trên điện thoại hoặc trình duyệt đang dùng.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white ${isEnabled ? "bg-emerald-600" : "bg-slate-400"}`}>
                {isEnabled ? <FaBell /> : <FaBellSlash />}
              </span>
              <div>
                <div className="text-sm font-bold text-slate-500">Trạng thái thiết bị này</div>
                <div className={`text-lg font-black ${isEnabled ? "text-emerald-700" : "text-slate-700"}`}>
                  {isLoading ? "Đang xử lý..." : isEnabled ? "Đang bật thông báo" : "Đang tắt thông báo"}
                </div>
              </div>
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-500">
              Quyền trình duyệt: {permission === "granted" ? "Đã cho phép" : permission === "denied" ? "Đang bị chặn" : "Chưa cấp quyền"}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleEnablePush}
              disabled={isLoading || isEnabled}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 font-bold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FaPaperPlane /> Bật thông báo
            </button>
            <button
              onClick={handleDisablePush}
              disabled={isLoading || !isEnabled}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FaBellSlash /> Tắt thông báo
            </button>
          </div>
        </div>

        {message && (
          <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-700">
            {message}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-white bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
            <span className="rounded-xl bg-sky-600 p-2 text-white"><FaMapMarkedAlt /></span>
            Bản đồ
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-600">Ngưỡng zoom</span>
            <input
              type="number"
              min="1"
              max="22"
              step="1"
              value={mapTooltipMinZoom}
              onChange={(event) => setMapTooltipMinZoom(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-bold text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <button
            onClick={handleSaveGeneralSettings}
            disabled={settingsSaving}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FaSave /> {settingsSaving ? "Đang lưu..." : "Lưu cài đặt"}
          </button>
        </div>

        <div className="mt-3 text-sm font-semibold text-slate-500">
          Gợi ý: `15` là mức hiện tại. Tăng số này thì phải zoom gần hơn mới hiện bảng; giảm số này thì bảng hiện sớm hơn.
        </div>

        {(settingsLoading || settingMessage) && (
          <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-700">
            {settingsLoading ? "Đang tải cài đặt chung..." : settingMessage}
          </div>
        )}
      </div>
    </div>
  );
};

const SettingsHub = ({ defaultTab }) => {
  const initialTab = tabs.some((tab) => tab.key === defaultTab) ? defaultTab : getSavedTab();
  const [activeTab, setActiveTab] = useState(
    tabs.some((tab) => tab.key === initialTab) ? initialTab : "groups"
  );
  const activeTabInfo = tabs.find((tab) => tab.key === activeTab) || tabs[0];

  useEffect(() => {
    localStorage.setItem("settingsHubTab", activeTab);
  }, [activeTab]);

  return (
    <div className="min-h-full bg-[#f4f7f2] p-4 text-slate-900 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-[26px] border border-white bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-xl bg-teal-600 p-3 text-white">
              <FaTools />
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Cài đặt</h1>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {tabs.map((tab) => {
              const selected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected
                      ? "border-teal-400 bg-teal-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${selected ? "bg-teal-600" : "bg-slate-400"}`}>
                      {tab.icon}
                    </span>
                    <span>
                      <span className="block font-black text-slate-900">{tab.label}</span>
                      <span className="text-xs font-semibold text-slate-500">{tab.description}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          {activeTabInfo.key === "groups" && <GroupNameTable embedded />}
          {activeTabInfo.key === "dnp" && <DnpSetting embedded />}
          {activeTabInfo.key === "notifications" && <GeneralSettings />}
        </div>
      </div>
    </div>
  );
};

export default SettingsHub;
