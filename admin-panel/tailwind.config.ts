/**
 * Tema.
 *
 * Renkler panelin kendi arayüzünden türetilmiştir: marka indigo'su logonun
 * (#4F46E5) ve panelde seçili menü öğesinin rengidir. Pazarlama sayfaları
 * artık bu paletin DIŞINA çıkmaz; önceden her sayfa kendi mor/pembe
 * gradyanını taşıdığı için site ile ürün birbirine yabancı görünüyordu.
 *
 * `accent` ailesi özellik gruplarını renkle ayırmak içindir. Rastgele değil,
 * panelde o özelliğin kartında kullanılan renkle aynıdır: konuşmalar mor,
 * analitik mavi, otomasyon yeşil, SSS kehribar, SLA gül.
 */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          // Eski anahtarlar korunur: panel bileşenleri bunlara sınıf adıyla
          // başvuruyor, silmek çalışan ekranları bozardı.
          purple: '#7b61ff',
          dark: '#0B0D17',
          card: '#151724',
          border: '#2A2D3A'
        },
        // Pazarlama sayfalarının zemin katmanları. Bölümler arasında beyaz ve
        // kırık beyaz dönüşümlü kullanılır; koyu temada karşılıkları verilir.
        surface: {
          light: '#ffffff',
          subtle: '#f8f9fc',
          muted: '#f1f3f9',
          dark: '#0b0d17',
          darkSubtle: '#11131f',
          darkMuted: '#171a29'
        }
      },
      boxShadow: {
        // Ürün görsellerinin sayfadan "kalkması" için. Renk nötr siyah değil
        // hafif indigo: beyaz zeminde saf siyah gölge kirli görünüyordu.
        panel: '0 1px 2px rgba(15,18,40,.04), 0 12px 32px -8px rgba(15,18,40,.10)',
        'panel-lg': '0 1px 2px rgba(15,18,40,.05), 0 28px 64px -16px rgba(15,18,40,.18)',
        glow: '0 0 0 1px rgba(79,70,229,.12), 0 18px 40px -12px rgba(79,70,229,.35)'
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'blob': 'blob 7s infinite',
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'rise': 'rise .6s cubic-bezier(.16,1,.3,1) both',
        'marquee': 'marquee 38s linear infinite',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'typing': 'typing 1.4s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        rise: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.45', transform: 'scale(.82)' },
        },
        typing: {
          '0%, 60%, 100%': { opacity: '.25', transform: 'translateY(0)' },
          '30%': { opacity: '1', transform: 'translateY(-3px)' },
        },
      }
    },
  },
  plugins: [],
}
