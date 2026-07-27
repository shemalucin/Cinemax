import { useApp } from "../context/AppContext";

export const CardSizeSelector = () => {
  const { cardSize, setCardSize } = useApp();

  const sizes = [
    { value: "small" as const, label: "S", fullLabel: "Small" },
    { value: "normal" as const, label: "M", fullLabel: "Normal" },
    { value: "large" as const, label: "L", fullLabel: "Large" },
  ];

  return (
    <div className="flex items-center gap-1.5 bg-white/5 rounded-lg p-1 border border-white/10">
      {sizes.map((size) => {
        const isActive = cardSize === size.value;
        return (
          <button
            key={size.value}
            onClick={() => setCardSize(size.value)}
            className={`flex items-center justify-center px-3 py-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
              isActive
                ? "bg-[#39FF14] text-black shadow-[0_0_10px_rgba(57,255,20,0.4)] scale-105"
                : "text-neutral-400 hover:text-white hover:bg-white/10"
            }`}
            title={`Set card size to ${size.fullLabel}`}
          >
            {size.label}
          </button>
        );
      })}
    </div>
  );
};
