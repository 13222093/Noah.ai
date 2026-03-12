import { create } from 'zustand';

interface LocationState {
  // Codes
  provinceCode: string | null;
  regencyCode: string | null;
  districtCode: string | null;
  // Display names
  provinceName: string | null;
  regencyName: string | null;
  districtName: string | null;
  // Coordinates (set when district selected)
  latitude: number | null;
  longitude: number | null;
  // Actions
  setProvince: (code: string | null, name: string | null) => void;
  setRegency: (code: string | null, name: string | null) => void;
  setDistrict: (code: string | null, name: string | null, lat?: number, lng?: number) => void;
  reset: () => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  provinceCode: null,
  regencyCode: null,
  districtCode: null,
  provinceName: null,
  regencyName: null,
  districtName: null,
  latitude: null,
  longitude: null,
  setProvince: (code, name) =>
    set({
      provinceCode: code,
      provinceName: name,
      regencyCode: null,
      regencyName: null,
      districtCode: null,
      districtName: null,
      latitude: null,
      longitude: null,
    }),
  setRegency: (code, name) =>
    set({
      regencyCode: code,
      regencyName: name,
      districtCode: null,
      districtName: null,
      latitude: null,
      longitude: null,
    }),
  setDistrict: (code, name, lat, lng) =>
    set({
      districtCode: code,
      districtName: name,
      latitude: lat ?? null,
      longitude: lng ?? null,
    }),
  reset: () =>
    set({
      provinceCode: null,
      regencyCode: null,
      districtCode: null,
      provinceName: null,
      regencyName: null,
      districtName: null,
      latitude: null,
      longitude: null,
    }),
}));
