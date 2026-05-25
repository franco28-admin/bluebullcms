const fs = require('fs');
const path = require('path');

// Paths
const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');
const templatePath = path.join(rootDir, 'index.html');
const translationsPath = path.join(rootDir, 'translations.json');

console.log('🚀 Iniciando compilación multi-idioma para BlueBull Tech...');

// Helper to ensure directory exists
function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

try {
  // 1. Read template and translations
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Plantilla no encontrada en: ${templatePath}`);
  }
  if (!fs.existsSync(translationsPath)) {
    throw new Error(`Traducciones no encontradas en: ${translationsPath}`);
  }

  const template = fs.readFileSync(templatePath, 'utf8');
  const translations = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));

  // 2. Setup dist directory (clear it first to ensure clean build)
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  ensureDirExists(distDir);

  const languages = ['es', 'en', 'pt'];

  languages.forEach((lang) => {
    console.log(`\n📄 Procesando idioma: [${lang.toUpperCase()}]`);
    let html = template;

    // Replace <html lang="es"> tag
    html = html.replace(/<html lang="es"/, `<html lang="${lang}"`);

    // Translate meta tags and title for non-Spanish languages
    if (lang !== 'es') {
      const trans = translations[lang];
      if (trans) {
        // Meta title
        if (trans.meta_title) {
          html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${trans.meta_title}</title>`);
        }
        // Meta description
        if (trans.meta_description) {
          html = html.replace(
            /<meta name="description" content="[\s\S]*?"\s*\/?>/,
            `<meta name="description" content="${trans.meta_description}" />`
          );
        }
        // Meta keywords
        if (trans.meta_keywords) {
          html = html.replace(
            /<meta name="keywords" content="[\s\S]*?"\s*\/?>/,
            `<meta name="keywords" content="${trans.meta_keywords}" />`
          );
        }
        // Open Graph title
        if (trans.og_title) {
          html = html.replace(
            /<meta property="og:title" content="[\s\S]*?"\s*\/?>/,
            `<meta property="og:title" content="${trans.og_title}" />`
          );
        }
        // Open Graph description
        if (trans.og_description) {
          html = html.replace(
            /<meta property="og:description" content="[\s\S]*?"\s*\/?>/,
            `<meta property="og:description" content="${trans.og_description}" />`
          );
        }
      }
    }

    // Process all <!--i18n:KEY-->...<!--/i18n--> comment blocks
    const i18nRegex = /<!--i18n:(\w+)-->([\s\S]*?)<!--\/i18n-->/g;
    html = html.replace(i18nRegex, (match, key, originalContent) => {
      // Spanish keeps original content (which is already in Spanish) but removes the comments
      if (lang === 'es') {
        return originalContent;
      }

      const trans = translations[lang];
      if (!trans) {
        return originalContent; // Fallback to original content if language translations don't exist
      }

      // Special case: input and textarea placeholders
      if (key.startsWith('input_')) {
        const suffix = key.substring(6); // e.g., "fullname"
        const placeholderKey = `placeholder_${suffix}`;
        const translatedPlaceholder = trans[placeholderKey];

        if (translatedPlaceholder) {
          // Replace placeholder="..." attribute in originalContent
          const updatedContent = originalContent.replace(
            /placeholder="[\s\S]*?"/,
            `placeholder="${translatedPlaceholder}"`
          );
          return updatedContent;
        } else {
          console.warn(`⚠️ Advertencia: Placeholder no encontrado para clave: ${placeholderKey} en idioma [${lang}]`);
          return originalContent;
        }
      }

      // Normal translation
      const translatedText = trans[key];
      if (translatedText !== undefined) {
        return translatedText;
      } else {
        console.warn(`⚠️ Advertencia: Traducción no encontrada para clave: ${key} en idioma [${lang}]`);
        return originalContent;
      }
    });

    // Remove the local-market section for generic language pages
    html = html.replace(/<!-- Local Market Profile Section \(Dynamic\) -->[\s\S]*?<!-- B2B Lead Form Section -->/, '<!-- B2B Lead Form Section -->');

    // Replace relative assets paths with absolute paths for the subdirectories
    // style.css -> /style.css
    // main.js -> /main.js
    html = html.replace(/href="style\.css"/g, 'href="/style.css"');
    html = html.replace(/src="main\.js"/g, 'src="/main.js"');

    // Save index.html inside lang directory
    const langDir = path.join(distDir, lang);
    ensureDirExists(langDir);
    fs.writeFileSync(path.join(langDir, 'index.html'), html, 'utf8');
    console.log(`✅ Archivo index.html generado con éxito en /dist/${lang}/index.html`);
  });

  // Generate country specific pages
  const countriesPath = path.join(rootDir, 'countries.json');
  if (fs.existsSync(countriesPath)) {
    const countries = JSON.parse(fs.readFileSync(countriesPath, 'utf8'));
    countries.forEach(country => {
      console.log(`\n🌎 Procesando país: [${country.name.toUpperCase()}]`);
      const baseLang = country.id === 'br' ? 'pt' : 'es';
      let html = template;

      // Replace lang tag
      html = html.replace(/<html lang="es"/, `<html lang="${baseLang}"`);

      // Apply base language translations if not Spanish
      if (baseLang !== 'es') {
        const trans = translations[baseLang];
        if (trans) {
          const i18nRegex = /<!--i18n:(\w+)-->([\s\S]*?)<!--\/i18n-->/g;
          html = html.replace(i18nRegex, (match, key, originalContent) => {
            if (key.startsWith('input_')) {
              const suffix = key.substring(6);
              const translatedPlaceholder = trans[`placeholder_${suffix}`];
              if (translatedPlaceholder) {
                return originalContent.replace(/placeholder="[\s\S]*?"/, `placeholder="${translatedPlaceholder}"`);
              }
              return originalContent;
            }
            return trans[key] !== undefined ? trans[key] : originalContent;
          });
        }
      } else {
        // Strip i18n comments for Spanish
        const i18nRegex = /<!--i18n:(\w+)-->([\s\S]*?)<!--\/i18n-->/g;
        html = html.replace(i18nRegex, '$2');
      }

      // Inject Country specific data
      Object.keys(country).forEach(key => {
        const countryRegex = new RegExp(`<!--country:${key}-->`, 'g');
        html = html.replace(countryRegex, country[key]);
      });

      // Override meta tags with country specific ones for SEO
      html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${country.meta_title}</title>`);
      html = html.replace(
        /<meta name="description" content="[\s\S]*?"\s*\/?>/,
        `<meta name="description" content="${country.meta_description}" />`
      );
      html = html.replace(
        /<meta property="og:title" content="[\s\S]*?"\s*\/?>/,
        `<meta property="og:title" content="${country.meta_title}" />`
      );
      html = html.replace(
        /<meta property="og:description" content="[\s\S]*?"\s*\/?>/,
        `<meta property="og:description" content="${country.meta_description}" />`
      );

      // Fix assets paths
      html = html.replace(/href="style\.css"/g, 'href="/style.css"');
      html = html.replace(/src="main\.js"/g, 'src="/main.js"');

      // Save to dist/country.id/index.html
      const countryDir = path.join(distDir, country.id);
      ensureDirExists(countryDir);
      fs.writeFileSync(path.join(countryDir, 'index.html'), html, 'utf8');
      console.log(`✅ Archivo index.html generado con éxito en /dist/${country.id}/index.html`);
    });
  }

  // 3. Copy global assets to /dist root
  console.log('\n📦 Copiando recursos globales a la carpeta /dist...');
  fs.copyFileSync(path.join(rootDir, 'style.css'), path.join(distDir, 'style.css'));
  console.log('✅ style.css copiado a /dist/style.css');

  fs.copyFileSync(path.join(rootDir, 'main.js'), path.join(distDir, 'main.js'));
  console.log('✅ main.js copiado a /dist/main.js');

  // Copy admin files
  const adminFiles = ['admin-login.html', 'admin-login.js', 'admin.html', 'admin.js'];
  adminFiles.forEach(file => {
    const srcPath = path.join(rootDir, file);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(distDir, file));
      console.log(`✅ ${file} copiado a /dist/${file}`);
    }
  });

  // We will copy _redirects to dist root as well if it exists
  const redirectsSrc = path.join(rootDir, '_redirects');
  if (fs.existsSync(redirectsSrc)) {
    fs.copyFileSync(redirectsSrc, path.join(distDir, '_redirects'));
    console.log('✅ _redirects copiado a /dist/_redirects');
  }

  console.log('\n🎉 ¡Compilación finalizada exitosamente! Todo listo para producción.');

} catch (error) {
  console.error('\n❌ Error durante la compilación:', error.message);
  process.exit(1);
}
