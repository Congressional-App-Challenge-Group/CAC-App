export function CityscapeFallback() {
  const buildings = [
    { x: 6, width: 8, height: 36, tone: "glass" },
    { x: 15, width: 9, height: 53, tone: "blue" },
    { x: 26, width: 7, height: 44, tone: "glass" },
    { x: 35, width: 10, height: 66, tone: "civic" },
    { x: 46, width: 8, height: 49, tone: "glass" },
    { x: 56, width: 11, height: 58, tone: "blue" },
    { x: 68, width: 8, height: 42, tone: "glass" },
    { x: 77, width: 10, height: 55, tone: "blue" },
    { x: 88, width: 7, height: 35, tone: "glass" },
  ];

  return (
    <div className="city-fallback" aria-hidden="true">
      <div className="city-fallback__moon" />
      <div className="city-fallback__ridge city-fallback__ridge--far" />
      <div className="city-fallback__ridge city-fallback__ridge--near" />
      <div className="city-fallback__skyline">
        {buildings.map((building, index) => (
          <span
            key={index}
            className={`city-fallback__building city-fallback__building--${building.tone}`}
            style={{ left: `${building.x}%`, width: `${building.width}%`, height: `${building.height}%` }}
          />
        ))}
      </div>
      <div className="city-fallback__hall"><i /><i /><i /><i /><i /></div>
      <div className="city-fallback__road" />
      <div className="city-fallback__horizon" />
    </div>
  );
}
