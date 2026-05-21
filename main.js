/* BlueBull Tech B2B Landing Page Interactive Logic */

const TRANSLATIONS = {
  es: {
    loadingText: "Procesando...",
    errorRequired: "Este campo es requerido",
    errorEmail: "Por favor, ingresÃ¡ un email vÃ¡lido",
    successTitle: "Â¡Solicitud Recibida!",
    successDesc: (name) => `Muchas gracias por contactarte con nosotros, <strong>${name}</strong>. Tu caso estÃ¡ siendo analizado por nuestro equipo de expansiÃ³n.<br><br>Un representante comercial de <strong>BlueBull Tech</strong> se pondrÃ¡ en contacto con vos en las prÃ³ximas 24 horas hÃ¡biles para coordinar una reuniÃ³n estratÃ©gica.`,
    successBtnText: "Volver a BlueBull Principal"
  },
  en: {
    loadingText: "Processing...",
    errorRequired: "This field is required",
    errorEmail: "Please enter a valid email",
    successTitle: "Request Received!",
    successDesc: (name) => `Thank you very much for contacting us, <strong>${name}</strong>. Your case is being analyzed by our expansion team.<br><br>A sales representative from <strong>BlueBull Tech</strong> will contact you within the next 24 business hours to coordinate a strategic meeting.`,
    successBtnText: "Back to BlueBull Main"
  },
  pt: {
    loadingText: "Processando...",
    errorRequired: "Este campo Ã© obrigatÃ³rio",
    errorEmail: "Por favor, insira um e-mail vÃ¡lido",
    successTitle: "SolicitaÃ§Ã£o Recebida!",
    successDesc: (name) => `Muito obrigado por entrar em contato conosco, <strong>${name}</strong>. Seu caso estÃ¡ sendo analisado por nossa equipe de expansÃ£o.<br><br>Um representante comercial da <strong>BlueBull Tech</strong> entrarÃ¡ em contato com vocÃª nas prÃ³ximas 24 horas Ãºteis para coordenar uma reuniÃ£o estratÃ©gica.`,
    successBtnText: "Voltar para o BlueBull Principal"
  }
};

const getLang = () => document.documentElement.lang || 'es';
const t = () => TRANSLATIONS[getLang()] || TRANSLATIONS.es;

document.addEventListener("DOMContentLoaded", () => {
  initHeaderScroll();
  initScrollReveals();
  initLeadForm();
  initInteractiveMap();
  initStatCounters();
  initLocalization();
});

/**
 * 1. Dynamic Header Scroll Transformation
 * Shrinks header slightly and adds glassmorphic glow border when scrolled.
 */
function initHeaderScroll() {
  const header = document.getElementById("header");
  if (!header) return;

  const handleScroll = () => {
    if (window.scrollY > 50) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  };

  window.addEventListener("scroll", handleScroll);
  handleScroll(); // Check on load
}

/**
 * 2. Scroll-Driven Reveal Animations (Intersection Observer)
 * Gracefully animates elements into view as the user scrolls.
 */
function initScrollReveals() {
  const reveals = document.querySelectorAll(".reveal");
  if (reveals.length === 0) return;

  const observerOptions = {
    root: null,
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px"
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
        observer.unobserve(entry.target); // Animates only once
      }
    });
  }, observerOptions);

  reveals.forEach(element => {
    observer.observe(element);
  });
}

/**
 * 3. High-Fidelity B2B Lead Form Validation and Option C Success State
 */
function initLeadForm() {
  const form = document.getElementById("lead-form");
  const formContainer = document.getElementById("form-container");
  
  if (!form || !formContainer) return;

  const inputs = form.querySelectorAll("input[required], select[required]");

  // Real-time validation visual state triggers
  inputs.forEach(input => {
    input.addEventListener("blur", () => validateField(input));
    input.addEventListener("input", () => {
      // Clear error immediately when typing
      const group = input.closest(".form-group");
      if (group && group.classList.contains("has-error")) {
        group.classList.remove("has-error");
        const existingError = group.querySelector(".error-msg");
        if (existingError) existingError.remove();
      }
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    let isFormValid = true;
    inputs.forEach(input => {
      const isValid = validateField(input);
      if (!isValid) isFormValid = false;
    });

    if (isFormValid) {
      // Show loading state on submit button
      const submitBtn = form.querySelector(".form-submit-btn");
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="spinner" viewBox="0 0 50 50" style="width: 20px; height: 20px; animation: spin 1s linear infinite; margin-right: 10px; fill: none; stroke: currentColor; stroke-width: 5; stroke-linecap: round;">
          <circle cx="25" cy="25" r="20" stroke-dasharray="1, 150" stroke-dashoffset="0"></circle>
        </svg> ${t().loadingText}
      `;

      // Inject spinner styling in runtime if not present
      if (!document.getElementById("spinner-runtime-style")) {
        const style = document.createElement("style");
        style.id = "spinner-runtime-style";
        style.innerHTML = `
          @keyframes spin { 100% { transform: rotate(360deg); } }
          .spinner circle { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
        `;
        document.head.appendChild(style);
      }

      // Real API request to Netlify Forms
      const formData = new FormData(form);
      
      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(formData).toString()
      })
      .then(() => {
        console.log("BlueBull Tech Lead Capture Submitted Successfully");
        // Show premium success card
        renderSuccessState(formContainer, document.getElementById("fullname").value);
      })
      .catch((error) => {
        console.error("Form submission error:", error);
        alert("Hubo un error al enviar el formulario. Por favor, intentÃ¡ nuevamente.");
        
        // Revert UI to allow retry
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      });
    }
  });
}

function validateField(input) {
  const group = input.closest(".form-group");
  if (!group) return true;

  // Clear existing error state
  group.classList.remove("has-error");
  const existingError = group.querySelector(".error-msg");
  if (existingError) existingError.remove();

  let isValid = true;
  let errorMsg = t().errorRequired;

  if (!input.value.trim()) {
    isValid = false;
  } else if (input.type === "email") {
    // Simple B2B corporate email check validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(input.value)) {
      isValid = false;
      errorMsg = t().errorEmail;
    }
  }

  if (!isValid) {
    group.classList.add("has-error");
    const errorEl = document.createElement("span");
    errorEl.className = "error-msg";
    errorEl.textContent = errorMsg;
    group.appendChild(errorEl);
  }

  return isValid;
}

/**
 * Option C: Renders a gorgeous success message with high-contrast redirection button
 */
function renderSuccessState(container, name) {
  // Gracefully transition out current form content
  container.style.opacity = 0;
  container.style.transition = "opacity 0.4s ease";

  setTimeout(() => {
    container.innerHTML = `
      <div class="success-card">
        <div class="success-icon-container">
          <svg viewBox="0 0 24 24">
            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
          </svg>
        </div>
        <h3>${t().successTitle}</h3>
        <p>
          ${t().successDesc(escapeHTML(name))}
        </p>
        <a href="https://bluebull.tech" class="btn btn-primary" style="padding: 16px 40px; box-shadow: var(--shadow-glow-large);">
          ${t().successBtnText}
        </a>
      </div>
    `;
    container.style.opacity = 1;
  }, 400);
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

/**
 * 4. Interactive Region Selection Hover Highlight
 */
function initInteractiveMap() {
  const pills = document.querySelectorAll(".market-pill");
  const pings = {
    latam: document.querySelectorAll(".ping-br, .ping-co, .ping-mx, .ping-ar"),
    eu: document.querySelectorAll(".ping-es-pt, .ping-mt")
  };
  const countries = {
    latam: document.querySelectorAll("#br, #co, #mx, #ar"),
    eu: document.querySelectorAll("#es, #pt, #mt")
  };

  pills.forEach(pill => {
    pill.addEventListener("mouseenter", () => {
      const region = pill.getAttribute("data-region");
      highlightRegion(region, true);
    });

    pill.addEventListener("mouseleave", () => {
      const region = pill.getAttribute("data-region");
      highlightRegion(region, false);
    });
  });

  function highlightRegion(region, isActive) {
    if (pings[region]) {
      pings[region].forEach(ping => {
        if (isActive) {
          ping.style.transform = "translate(-50%, -50%) scale(1.5)";
          ping.style.boxShadow = "0 0 20px #00bfff, 0 0 40px #00bfff";
          ping.style.filter = "brightness(1.5)";
        } else {
          ping.style.transform = "translate(-50%, -50%) scale(1)";
          ping.style.boxShadow = "0 0 10px #00bfff, 0 0 20px #00bfff";
          ping.style.filter = "none";
        }
        ping.style.transition = "all 0.3s ease";
      });
    }

    if (countries[region]) {
      countries[region].forEach(path => {
        if (isActive) {
          path.style.fill = "rgba(0, 191, 255, 0.4)";
          path.style.stroke = "#ffffff";
          path.style.filter = "drop-shadow(0 0 12px rgba(0, 191, 255, 0.9))";
        } else {
          path.style.fill = "";
          path.style.stroke = "";
          path.style.filter = "";
        }
      });
    }
  }
}

/**
 * 5. Statistics Count-Up Animation
 */
function initStatCounters() {
  const statItems = document.querySelectorAll(".stat-item h3");
  if (statItems.length === 0) return;

  const observerOptions = {
    threshold: 0.5
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  statItems.forEach(item => {
    observer.observe(item);
  });
}

function animateCounter(element) {
  const text = element.textContent;
  const target = parseFloat(element.getAttribute("data-count"));
  if (isNaN(target)) return;

  const isPercentage = text.includes("%");
  const isPlus = text.includes("+");
  const isDegree = text.includes("Â°");
  const isMillions = text.includes("M");

  let start = 0;
  const duration = 2000; // 2 seconds animation
  const stepTime = 30; // ms per step
  const steps = duration / stepTime;
  const increment = target / steps;
  let currentStep = 0;

  const timer = setInterval(() => {
    currentStep++;
    start += increment;

    if (currentStep >= steps) {
      clearInterval(timer);
      element.textContent = text; // Set final text to keep original formats (M, +, %, Â°)
    } else {
      let formattedVal = start.toFixed(isPercentage ? 1 : 0);
      if (isMillions) {
        element.textContent = formattedVal + "M+";
      } else if (isPercentage) {
        element.textContent = formattedVal + "%";
      } else if (isPlus) {
        element.textContent = formattedVal + "+";
      } else if (isDegree) {
        element.textContent = formattedVal + "Â°";
      } else {
        element.textContent = formattedVal;
      }
    }
  }, stepTime);
}
/**
 * 6. Advanced Subdomain Localization
 */
function initLocalization() {
  const hostname = window.location.hostname;
  
  // Market Configurations
  const markets = {
    ar: {
      id: 'ar',
      name: 'Argentina',
      color: '#75AADB',
      glow: 'rgba(117, 170, 219, 0.4)',
      titleSuffix: 'EN EL MERCADO ARGENTINO'
    },
    co: {
      id: 'co',
      name: 'Colombia',
      color: '#FCD116',
      glow: 'rgba(252, 209, 22, 0.4)',
      titleSuffix: 'EN EL MERCADO COLOMBIANO'
    },
    mx: {
      id: 'mx',
      name: 'México',
      color: '#006847',
      glow: 'rgba(0, 104, 71, 0.4)',
      titleSuffix: 'EN EL MERCADO MEXICANO'
    }
  };

  let activeMarket = null;
  if (hostname.startsWith('ar.')) activeMarket = markets.ar;
  else if (hostname.startsWith('co.')) activeMarket = markets.co;
  else if (hostname.startsWith('mx.')) activeMarket = markets.mx;
  
  // Para pruebas locales (descomentar para testear):
  // activeMarket = markets.ar;

  if (activeMarket) {
    console.log('BlueBull Localization Active:', activeMarket.name);
    
    // 1. Inyectar variables CSS
    document.documentElement.style.setProperty('--bright-blue', activeMarket.color);
    document.documentElement.style.setProperty('--accent-glow', activeMarket.glow);
    
    // 2. Modificar Hero Title (El degradado del texto se aplica desde CSS)
    const heroTitle = document.getElementById('hero-title-dynamic');
    if (heroTitle) {
      heroTitle.innerHTML = 'ESCALANDO TU VISIÓN ' + activeMarket.titleSuffix;
    }
    
    // 3. Ocultar el Trust Badge base si existe
    const badge = document.getElementById('hero-trust-badge');
    if (badge) {
      badge.style.display = 'none';
    }
    
    // 4. Actualizar Formulario Oculto
    const hiddenInput = document.getElementById('detected-country');
    if (hiddenInput) {
      hiddenInput.value = activeMarket.name;
    }
    
    // 5. Pre-seleccionar dropdown del formulario si aplica
    const marketSelect = document.getElementById('market-select');
    if (marketSelect) {
      marketSelect.value = 'latam';
    }

    // 6. Resaltar en el Mapa Interactivo (Delayed para esperar carga de CSS)
    setTimeout(() => {
      const pingId = '.ping-' + activeMarket.id;
      const pathId = '#' + activeMarket.id;
      
      const pingEls = document.querySelectorAll(pingId);
      pingEls.forEach(ping => {
        ping.style.transform = "translate(-50%, -50%) scale(2)";
        ping.style.boxShadow = "0 0 20px " + activeMarket.color + ", 0 0 40px " + activeMarket.color;
        ping.style.filter = "brightness(1.5)";
        ping.style.background = activeMarket.color;
        ping.style.zIndex = "10";
      });
      
      const pathEls = document.querySelectorAll(pathId);
      pathEls.forEach(path => {
        path.style.fill = activeMarket.glow;
        path.style.stroke = activeMarket.color;
        path.style.filter = "drop-shadow(0 0 12px " + activeMarket.glow + ")";
      });
    }, 500);
  }
}
