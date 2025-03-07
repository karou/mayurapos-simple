type MetricType = {
    id: string;
    name: string;
    value: number;
  };
  
  type ReportHandler = (metric: MetricType) => void;
  
  const reportWebVitals = (onPerfEntry?: ReportHandler): void => {
    if (onPerfEntry && onPerfEntry instanceof Function) {
      void import('web-vitals').then((webVitals) => {
        webVitals.onCLS(onPerfEntry);
        webVitals.onFID(onPerfEntry);
        webVitals.onFCP(onPerfEntry);
        webVitals.onLCP(onPerfEntry);
        webVitals.onTTFB(onPerfEntry);
      });
    }
  };
  
  export default reportWebVitals;