"use client";

import { create } from "zustand";
import { ModelPerformance, MarketData } from "@/types/trading";

interface TradingState {
  // 状态
  performances: ModelPerformance[];
  marketData: MarketData[];
  isRunning: boolean;
  isLoading: boolean;
  connectionStatus: string;

  // Actions
  setPerformances: (performances: ModelPerformance[]) => void;
  setMarketData: (marketData: MarketData[]) => void;
  setIsRunning: (isRunning: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  setConnectionStatus: (status: string) => void;
  updateAll: (data: {
    performances?: ModelPerformance[];
    marketData?: MarketData[];
    isRunning?: boolean;
  }) => void;
  reset: () => void;
}

const initialState = {
  performances: [],
  marketData: [],
  isRunning: false,
  isLoading: true,
  connectionStatus: "CONNECTING...",
};

export const useTradingStore = create<TradingState>((set) => ({
  ...initialState,

  setPerformances: (performances) => set({ performances }),
  setMarketData: (marketData) => set({ marketData }),
  setIsRunning: (isRunning) => set({ isRunning }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  updateAll: (data) =>
    set((state) => ({
      ...state,
      ...data,
    })),

  reset: () => set(initialState),
}));
