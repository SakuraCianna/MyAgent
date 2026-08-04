import styles from "./WeatherCard.module.css";

export interface WeatherData {
  city: string;
  condition: string;
  temperatureC: number;
  humidityPercent: number;
  feelsLikeC: number;
  windKmph: number;
  source?: string;
}

export interface WeatherCardProps {
  data: WeatherData;
}

export function WeatherCard({ data }: WeatherCardProps) {
  const {
    city,
    condition,
    temperatureC,
    humidityPercent,
    feelsLikeC,
    windKmph,
  } = data;

  const styleConfig = getStyleConfig(condition);
  const dateStr = getFormattedDate();

  return (
    <div className={`${styles.weatherPoster} ${styleConfig.posterClass}`}>
      {/* 悬浮主核心胶囊玻璃卡片 */}
      <div className={`${styles.innerPillCard} ${styleConfig.pillClass}`}>
        {/* 顶栏内容 */}
        <div className={styles.cardTopRow}>
          <div className={styles.tempCityGroup}>
            <div className={styles.tempText}>{temperatureC}°C</div>
            <div className={styles.cityName}>{city}</div>
          </div>
          <div className={styles.rightIconGroup}>
            <div className={styles.weatherIconWrap}>
              <WeatherConditionIcon condition={condition} />
            </div>
            <div className={styles.dateStr}>{dateStr}</div>
          </div>
        </div>

        {/* 底部动态热浪 / 水波流动动画效果 */}
        <svg
          className={styles.heatwaveContainer}
          viewBox="0 0 1000 100"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            className={styles.wavePath1}
            d="M0,50 Q250,20 500,65 T1000,40 L1000,100 L0,100 Z"
            fill="rgba(255, 255, 255, 0.22)"
          />
          <path
            className={styles.wavePath2}
            d="M0,65 Q250,75 500,35 T1000,55 L1000,100 L0,100 Z"
            fill="rgba(255, 255, 255, 0.15)"
          />
        </svg>
      </div>

      {/* 胶囊卡片下方的诗意名句与天气状态 */}
      <div className={styles.poemRow}>
        <div className={styles.poemQuote}>{styleConfig.quote}</div>
        <div className={styles.statusTag}>—— {condition}</div>
      </div>

      {/* 气象细分指标说明 */}
      <div className={styles.metricsBar}>
        <div className={styles.metricItem}>
          <span>体感</span>
          <strong>{feelsLikeC}°C</strong>
        </div>
        <span>•</span>
        <div className={styles.metricItem}>
          <span>湿度</span>
          <strong>{humidityPercent}%</strong>
        </div>
        <span>•</span>
        <div className={styles.metricItem}>
          <span>风速</span>
          <strong>{windKmph} km/h</strong>
        </div>
      </div>
    </div>
  );
}

function getFormattedDate(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  return `${day} ${month} ${year}`;
}

interface StyleConfig {
  posterClass: string;
  pillClass: string;
  quote: string;
}

function getStyleConfig(condition: string): StyleConfig {
  const cond = condition.toLowerCase();
  if (cond.includes("晴") || cond.includes("sun") || cond.includes("clear")) {
    return {
      posterClass: styles.posterSunny,
      pillClass: styles.pillSunny,
      quote: "许我一丝微光，照亮你前进的方向",
    };
  }
  if (cond.includes("雨") || cond.includes("rain") || cond.includes("shower") || cond.includes("thunder")) {
    return {
      posterClass: styles.posterRainy,
      pillClass: styles.pillRainy,
      quote: "但盼风雨来，能留你在此",
    };
  }
  if (cond.includes("云") || cond.includes("阴") || cond.includes("cloud") || cond.includes("overcast")) {
    return {
      posterClass: styles.posterCloudy,
      pillClass: styles.pillCloudy,
      quote: "南北各万里，有云心更闲",
    };
  }
  if (cond.includes("雪") || cond.includes("snow") || cond.includes("sleet")) {
    return {
      posterClass: styles.posterSnowy,
      pillClass: styles.pillSnowy,
      quote: "孤径飞声花，雪夜伴人归",
    };
  }
  return {
    posterClass: styles.posterDefault,
    pillClass: styles.pillDefault,
    quote: "久别重逢，山谷有风",
  };
}

function WeatherConditionIcon({ condition }: { condition: string }) {
  const cond = condition.toLowerCase();
  if (cond.includes("晴") || cond.includes("sun") || cond.includes("clear")) {
    return (
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        className={styles.sunIcon}
      >
        <circle cx="12" cy="12" r="4.5" fill="#ffe082" stroke="#ffa726" />
        <g className={styles.sunRays}>
          <path
            d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
            stroke="#ffe082"
            strokeLinecap="round"
          />
        </g>
      </svg>
    );
  }
  if (cond.includes("雨") || cond.includes("rain") || cond.includes("shower") || cond.includes("thunder")) {
    return (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
        <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" fill="rgba(255,255,255,0.4)" stroke="#93c5fd" />
        <path className={styles.rainDrop1} d="M8 17v3" stroke="#60a5fa" strokeWidth="2.2" strokeLinecap="round" />
        <path className={styles.rainDrop2} d="M12 17v3" stroke="#93c5fd" strokeWidth="2.2" strokeLinecap="round" />
        <path className={styles.rainDrop3} d="M16 17v3" stroke="#60a5fa" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
      <path d="M18 10h-1.26A8 8 0 1 0 3 16.3h15a5 5 0 0 0 0-10z" fill="rgba(255,255,255,0.35)" />
    </svg>
  );
}
