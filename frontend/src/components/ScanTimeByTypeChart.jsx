import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const ScanTimeByTypeChart = ({ scans }) => {
  // Fonction pour calculer le temps par type de scan
  const compterTempsParType = (scans) => {
    const types = {};
    scans.forEach(scan => {
      const duration = scan.finished_at && scan.started_at && scan.status === "completed"
        ? (new Date(scan.started_at)) - (new Date(scan.finished_at))
        : 0;
      const hours = duration / (1000 * 60 * 60);
      
      if (!types[scan.type]) {
        types[scan.type] = 0;
      }
      types[scan.type] += hours;
    });
    
    return Object.entries(types).map(([type, temps]) => ({
      type,
      temps: parseFloat(temps.toFixed(2))
    }));
  };

  const timeData = compterTempsParType(scans);
  const totalHours = timeData.reduce((sum, item) => sum + item.temps, 0);

  const data = {
    labels: timeData.map(item => item.type),
    datasets: [{
      label: "Temps (heures)",
      data: timeData.map(item => item.temps),
      backgroundColor: [
        "hsl(350, 89%, 60%)",  
        "hsl(215, 73.80%, 40.40%)"
      ],
      borderColor: "hsl(var(--background))",
      borderWidth: 2,
      hoverOffset: 10
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "hsl(0, 0%, 90%)",
          font: {
            size: 14,
            family: "'Inter', sans-serif"
          },
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: "hsl(var(--popover))",
        titleColor: "hsl(var(--popover-foreground))",
        bodyColor: "hsl(var(--popover-foreground))",
        borderColor: "hsl(var(--border))",
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: function(context) {
            const percentage = totalHours > 0 
              ? Math.round((context.raw / totalHours) * 100)
              : 0;
            return ` ${context.label}: ${context.raw}h (${percentage}%)`;
          }
        }
      }
    },
    cutout: "70%",
    animation: {
      animateScale: true,
      animateRotate: true
    }
  };

  return (
    <div className="p-8 rounded-xl bg-slate-900/60 border border-white/10 shadow-md hover:bg-slate-900/70 transition-background duration-200">
      <h3 className="text-2xl font-semibold text-rose-400 mb-4 text-center">Temps total par type de scan</h3>
      <div className="h-64 w-full">
        <Doughnut 
          data={data} 
          options={options}
        />
      </div>
      <div className="mt-4 text-center text-sm text-foreground">
        <p>
          Total: {totalHours.toFixed(2)} heures | {scans.length} scans analysés
        </p>
      </div>
    </div>
  );
};

export default ScanTimeByTypeChart;