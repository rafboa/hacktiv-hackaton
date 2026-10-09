import { motion } from 'framer-motion';

const REASONING_SUGGESTIONS = [
  'Aku menghitung angka awal sebagai langkah pertama.',
  'Aku mulai dari angka awal lalu maju satu-satu.',
  'Aku bingung saat melewati angka 10.',
];

interface ReasoningInputProps {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
}

export default function ReasoningInput({ value, loading, onChange, onSubmit, onSkip }: ReasoningInputProps) {
  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="w-full max-w-lg rounded-3xl border-2 border-[#E8DCCB] bg-white p-5 shadow-md"
      aria-labelledby="reasoning-title"
    >
      <h2 id="reasoning-title" className="text-xl font-bold text-[#2C2C2C]">
        Bagaimana kamu menghitungnya?
      </h2>
      <p className="mt-1 text-sm text-[#777]">Kamu boleh menulis sendiri atau memilih contoh.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {REASONING_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={loading}
            onClick={() => onChange(suggestion)}
            className="rounded-full border border-[#D8E6F5] bg-[#F3F8FD] px-3 py-2 text-left text-sm text-[#34516D] transition hover:bg-[#E8F1FB] disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <label htmlFor="reasoning-text" className="mt-4 block text-sm font-semibold text-[#555]">
        Ceritakan dengan kata-katamu
      </label>
      <textarea
        id="reasoning-text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={500}
        rows={3}
        disabled={loading}
        placeholder="Contoh: Aku mulai menghitung dari angka 8..."
        className="mt-2 w-full resize-none rounded-2xl border border-gray-200 bg-[#FFFEFC] p-3 text-base text-[#2C2C2C] outline-none transition focus:border-[#4A90D9] focus:ring-2 focus:ring-[#4A90D9]/20 disabled:opacity-60"
      />

      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onSkip}
          disabled={loading}
          className="rounded-xl px-4 py-2 font-semibold text-[#777] transition hover:bg-gray-100 disabled:opacity-50"
        >
          Lewati
        </button>
        <button
          type="submit"
          disabled={loading || value.trim().length === 0}
          className="rounded-xl bg-[#4A90D9] px-5 py-2 font-bold text-white transition hover:bg-[#367BC3] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Menyiapkan bantuan…' : 'Kirim alasan'}
        </button>
      </div>
    </motion.form>
  );
}
