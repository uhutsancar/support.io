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
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter Variable',
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif'
        ]
      },
      colors: {
        brand: {
          dark: '#0B0D17',
          card: '#151724'
        },
        // Pazarlama sayfalarının zemin katmanları. Bölümler arasında beyaz ve
        // kırık beyaz dönüşümlü kullanılır; koyu temada karşılıkları verilir.
        surface: {
          subtle: '#f8f9fc',
          dark: '#0b0d17',
          darkSubtle: '#11131f'
        }
      },
      boxShadow: {
        // Ürün görsellerinin sayfadan "kalkması" için. Renk nötr siyah değil
        // hafif indigo: beyaz zeminde saf siyah gölge kirli görünüyordu.
        panel: '0 1px 2px rgba(15,18,40,.04), 0 12px 32px -8px rgba(15,18,40,.10)',
        'panel-lg': '0 1px 2px rgba(15,18,40,.05), 0 28px 64px -16px rgba(15,18,40,.18)'
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        typing: 'typing 1.4s ease-in-out infinite'
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '.45', transform: 'scale(.82)' }
        },
        typing: {
          '0%, 60%, 100%': { opacity: '.25', transform: 'translateY(0)' },
          '30%': { opacity: '1', transform: 'translateY(-3px)' }
        }
      }
    }
  },
  plugins: []
};
