import React from 'react';
import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudDrizzle,
  CloudFog,
  CloudSnow,
  Wind,
  Droplets,
  Thermometer,
} from 'lucide-react';
import { WeatherConditionKey } from '../types';

interface WeatherIconProps {
  conditionKey: WeatherConditionKey;
  isDay?: boolean;
  className?: string;
  size?: number;
}

export const WeatherIcon: React.FC<WeatherIconProps> = ({
  conditionKey,
  isDay = true,
  className = 'w-6 h-6',
  size,
}) => {
  switch (conditionKey) {
    case 'clear':
      return isDay ? (
        <Sun size={size} className={`${className} text-amber-500 animate-[spin_30s_linear_infinite]`} />
      ) : (
        <Moon size={size} className={`${className} text-indigo-400`} />
      );
    case 'partly-cloudy':
      return isDay ? (
        <CloudSun size={size} className={`${className} text-amber-500`} />
      ) : (
        <CloudMoon size={size} className={`${className} text-indigo-300`} />
      );
    case 'overcast':
      return <Cloud size={size} className={`${className} text-slate-400`} />;
    case 'fog':
      return <CloudFog size={size} className={`${className} text-slate-400`} />;
    case 'drizzle':
      return <CloudDrizzle size={size} className={`${className} text-sky-400`} />;
    case 'rain':
      return <CloudRain size={size} className={`${className} text-blue-500`} />;
    case 'heavy-rain':
      return <CloudRain size={size} className={`${className} text-blue-600`} />;
    case 'thunderstorm':
      return <CloudLightning size={size} className={`${className} text-amber-500`} />;
    case 'snow':
      return <CloudSnow size={size} className={`${className} text-sky-300`} />;
    case 'unknown':
    default:
      return <Cloud size={size} className={`${className} text-slate-400`} />;
  }
};
