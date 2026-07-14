export function ToggleGroup({
  name,
  options,
  defaultValue,
}: {
  name: string
  options: { value: string; label: string }[]
  defaultValue: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <label key={opt.value} className="toggle-btn">
          <input
            type="radio"
            name={name}
            value={opt.value}
            defaultChecked={opt.value === defaultValue}
          />
          {opt.label}
        </label>
      ))}
    </div>
  )
}
