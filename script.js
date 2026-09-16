'use strict';

// ============================================
// ÉTAT GLOBAL DE L'APPLICATION
// ============================================
const APP = {
  config: null,
  modules: {},
  fidele: {},
  langue: 'fr',
  traductions: {},
  donnees: {},
  modeDB: false,
};

// ============================================
// INITIALISATION AU CHARGEMENT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Initialisation du Site-Vie EPC...');

    await chargerConfig();
    APP.langue = determinerLangue();
    document.documentElement.lang = APP.langue;
    await chargerTraductions();
    await chargerToutesDonnees();
    appliquerConfig();
    genererNavigation();
    activerModules();
    await chargerContenusModules();
    configurerInteractions();
    masquerChargement();

    console.log('Site-Vie pret !');
  } catch (erreur) {
    console.error('Erreur initialisation:', erreur);
    afficherErreur('Une erreur est survenue lors du chargement du site.');
  }
});

// ============================================
// 1. CHARGEMENT DE LA CONFIGURATION
// ============================================
async function chargerConfig() {
  try {
    const reponse = await fetch('config/config.json');
    if (!reponse.ok) throw new Error('config.json introuvable');
    APP.config = await reponse.json();
    APP.fidele = APP.config.fidele || {};
    APP.modules = APP.config.modules || {};
    console.log('Configuration chargee:', APP.fidele.nomComplet);
  } catch (erreur) {
    console.error('Erreur config.json:', erreur);
    APP.config = {
      fidele: { nomComplet: 'Fidele EPC', statut: 'vivant' },
      modules: {},
      langues: { parDefaut: 'fr', disponibles: ['fr', 'en'] }
    };
    APP.fidele = APP.config.fidele;
    APP.modules = APP.config.modules;
  }
}

// ============================================
// 2. DETERMINER LA LANGUE
// ============================================
function determinerLangue() {
  const params = new URLSearchParams(window.location.search);
  const langUrl = params.get('lang');
  if (langUrl) return langUrl;

  const langStockee = localStorage.getItem('epc-langue');
  if (langStockee) return langStockee;

  const langNavigateur = navigator.language ? navigator.language.slice(0, 2) : 'fr';
  const dispo = (APP.config && APP.config.langues && APP.config.langues.disponibles) || ['fr', 'en'];
  if (dispo.includes(langNavigateur)) return langNavigateur;

  return (APP.config && APP.config.langues && APP.config.langues.parDefaut) || 'fr';
}

// ============================================
// 3. CHARGER LES TRADUCTIONS
// ============================================
async function chargerTraductions() {
  try {
    const reponse = await fetch('i18n/' + APP.langue + '.json');
    if (!reponse.ok) throw new Error('Traductions introuvables');
    APP.traductions = await reponse.json();
  } catch (erreur) {
    console.warn('Traductions indisponibles, fallback fr');
    try {
      const reponse = await fetch('i18n/fr.json');
      APP.traductions = await reponse.json();
    } catch {
      APP.traductions = {};
    }
  }
}

// ============================================
// 4. CHARGER TOUTES LES DONNEES
// ============================================
async function chargerToutesDonnees() {
  const fichiers = [
    'biographie', 'galerie', 'videos', 'audios',
    'temoignages', 'activites', 'sacrements',
    'publications', 'telechargements',
    'programme_obseques', 'condoleances', 'hommages',
    'arbre_genealogique', 'faq'
  ];

  const promesses = fichiers.map(async (nom) => {
    try {
      const reponse = await fetch('data/' + nom + '.json');
      if (reponse.ok) {
        APP.donnees[nom] = await reponse.json();
      } else {
        APP.donnees[nom] = null;
      }
    } catch {
      APP.donnees[nom] = null;
    }
  });

  await Promise.all(promesses);
  console.log('Donnees chargees');
}

// ============================================
// 5. APPLIQUER LA CONFIGURATION
// ============================================
function appliquerConfig() {
  const fid = APP.fidele;
  const statut = fid.statut || 'vivant';
  const estMemoire = statut === 'memoire';

  const titrePrefix = estMemoire ? 'En memoire de ' : '';
  document.title = titrePrefix + (fid.nomComplet || 'Fidele EPC') + ' - Site-Vie EPC';

  if (estMemoire) {
    document.body.classList.add('mode-memoire');
    afficherBanniereMemoire();
  }

  const heroName = document.getElementById('hero-name');
  if (heroName) heroName.textContent = fid.nomComplet || 'Fidele EPC';

  const heroDates = document.getElementById('hero-dates');
  if (heroDates) {
    const naissance = formaterDate(fid.naissance);
    const deces = estMemoire ? formaterDate(fid.deces) : null;
    heroDates.textContent = deces ? naissance + ' - ' + deces : 'Ne(e) le ' + naissance;
  }

  const heroVerset = document.getElementById('hero-verset');
  if (heroVerset && fid.verset) {
    heroVerset.textContent = '"' + fid.verset + '"';
  }

  if (fid.photoBanniere) {
    const hero = document.getElementById('hero');
    if (hero) {
      hero.style.backgroundImage = "linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.55)), url('" + fid.photoBanniere + "')";
    }
  }

  const footerName = document.getElementById('footer-name');
  if (footerName) footerName.textContent = fid.nomComplet || 'Fidele EPC';

  const footerParoisse = document.getElementById('footer-paroisse');
  if (footerParoisse) footerParoisse.textContent = 'Paroisse ' + (fid.paroisse || 'EPC');

  const footerDates = document.getElementById('footer-dates');
  if (footerDates) {
    const naissance = formaterDate(fid.naissance);
    const deces = estMemoire ? ' - ' + formaterDate(fid.deces) : '';
    footerDates.textContent = naissance + deces;
  }

  const footerYear = document.getElementById('footer-year');
  if (footerYear) footerYear.textContent = new Date().getFullYear();

  const footerVersion = document.getElementById('footer-version');
  if (footerVersion && APP.config && APP.config.meta) {
    footerVersion.textContent = APP.config.meta.version || '1.0.0';
  }

  appliquerTraductions();
}

// ============================================
// APPLIQUER LES TRADUCTIONS AUX ELEMENTS [data-i18n]
// ============================================
function appliquerTraductions() {
  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    const key = el.getAttribute('data-i18n');
    if (APP.traductions[key]) {
      el.textContent = APP.traductions[key];
    }
  });
}

// ============================================
// FORMATER UNE DATE
// ============================================
function formaterDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const locale = APP.langue === 'en' ? 'en-GB' : 'fr-FR';
    return date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
}

// ============================================
// AFFICHER LA BANNIERE MEMOIRE
// ============================================
function afficherBanniereMemoire() {
  const banner = document.getElementById('memoire-banner');
  if (!banner) return;
  banner.classList.remove('d-none');
  const nameEl = document.getElementById('memoire-banner-name');
  if (nameEl) nameEl.textContent = APP.fidele.nomComplet || '';
  const datesEl = document.getElementById('memoire-banner-dates');
  if (datesEl) {
    const naissance = formaterDate(APP.fidele.naissance);
    const deces = formaterDate(APP.fidele.deces);
    datesEl.textContent = ' (' + naissance + ' - ' + deces + ')';
  }
}

// ============================================
// 6. GENERER LA NAVIGATION
// ============================================
function genererNavigation() {
  const navLinks = document.getElementById('nav-links');
  if (!navLinks) return;

  const mapping = [
    { module: 'biographie', ancre: 'biographie', i18n: 'nav-bio' },
    { module: 'galerie', ancre: 'galerie', i18n: 'nav-gallery' },
    { module: 'videos', ancre: 'videos', i18n: 'nav-videos' },
    { module: 'audios', ancre: 'audios', i18n: 'nav-audios' },
    { module: 'activites', ancre: 'activites', i18n: 'nav-activites' },
    { module: 'sacrements', ancre: 'sacrements', i18n: 'nav-sacrements' },
    { module: 'publications', ancre: 'publications', i18n: 'nav-publications' },
    { module: 'telechargements', ancre: 'telechargements', i18n: 'nav-telechargements' },
    { module: 'temoignages', ancre: 'temoignages', i18n: 'nav-temoignages' },
    { module: 'arbre_genealogique', ancre: 'arbre', i18n: 'nav-arbre' },
    { module: 'programme_obseques', ancre: 'programme-obseques', i18n: 'nav-programme' },
    { module: 'condoleances', ancre: 'condoleances', i18n: 'nav-condoleances' },
    { module: 'hommages', ancre: 'hommages', i18n: 'nav-hommages' },
    { module: 'faq', ancre: 'faq', i18n: 'nav-faq' }
  ];

  let html = '';
  mapping.forEach(function(item) {
    if (APP.modules[item.module]) {
      const texte = APP.traductions[item.i18n] || item.i18n;
      html += '<li class="nav-item"><a class="nav-link" href="#' + item.ancre + '">' + texte + '</a></li>';
    }
  });

  navLinks.innerHTML = html;
}

// ============================================
// 7. ACTIVER / MASQUER LES MODULES
// ============================================
function activerModules() {
  document.querySelectorAll('[data-module]').forEach(function(section) {
    const moduleName = section.getAttribute('data-module');
    if (!APP.modules[moduleName]) {
      section.classList.add('d-none');
    } else {
      section.classList.remove('d-none');
    }
  });
}

// ============================================
// 8. CHARGER LE CONTENU DES MODULES
// ============================================
async function chargerContenusModules() {
  if (APP.modules.biographie && APP.donnees.biographie) afficherBiographie(APP.donnees.biographie);
  if (APP.modules.galerie && APP.donnees.galerie) afficherGalerie(APP.donnees.galerie);
  if (APP.modules.videos && APP.donnees.videos) afficherVideos(APP.donnees.videos);
  if (APP.modules.audios && APP.donnees.audios) afficherAudios(APP.donnees.audios);
  if (APP.modules.activites && APP.donnees.activites) afficherActivites(APP.donnees.activites);
  if (APP.modules.sacrements && APP.donnees.sacrements) afficherSacrements(APP.donnees.sacrements);
  if (APP.modules.publications && APP.donnees.publications) afficherPublications(APP.donnees.publications);
  if (APP.modules.telechargements && APP.donnees.telechargements) afficherTelechargements(APP.donnees.telechargements);
  if (APP.modules.temoignages && APP.donnees.temoignages) afficherTemoignages(APP.donnees.temoignages);
  if (APP.modules.arbre_genealogique && APP.donnees.arbre_genealogique) afficherArbre(APP.donnees.arbre_genealogique);
  if (APP.modules.programme_obseques && APP.donnees.programme_obseques) afficherProgramme(APP.donnees.programme_obseques);
  if (APP.modules.hommages && APP.donnees.hommages) afficherHommages(APP.donnees.hommages);
  if (APP.modules.faq && APP.donnees.faq) afficherFAQ(APP.donnees.faq);
  if (APP.modules.condoleances) afficherCondoleances();
}

// ============================================
// 9. FONCTIONS D'AFFICHAGE PAR MODULE
// ============================================
function afficherBiographie(data) {
  const el = document.getElementById('bio-content');
  if (!el) return;
  let html = '';
  if (data.titre) html += '<h3 class="mb-4 text-center">' + data.titre + '</h3>';
  if (data.paragraphes) {
    html += data.paragraphes.map(function(p) { return '<p>' + p + '</p>'; }).join('');
  }
  if (data.citation) {
    html += '<blockquote class="blockquote text-center my-4 fst-italic"><p>' + data.citation + '</p></blockquote>';
  }
  el.innerHTML = html;
}

function afficherGalerie(data) {
  const grid = document.getElementById('galerie-grid');
  if (!grid) return;
  let html = '';
  (data.photos || []).forEach(function(photo) {
    html += '<div class="col-md-4 col-sm-6">' +
      '<div class="gallery-item">' +
      '<img src="' + photo.src + '" alt="' + (photo.legende || '') + '" loading="lazy">' +
      '</div>';
    if (photo.legende) {
      html += '<p class="text-center small text-muted mt-2">' + photo.legende + '</p>';
    }
    html += '</div>';
  });
  grid.innerHTML = html;

  const linkContainer = document.getElementById('galerie-link-container');
  if (linkContainer && data.albumComplet) {
    linkContainer.innerHTML = '<a href="' + data.albumComplet + '" target="_blank" class="btn btn-primary btn-lg">Voir album complet</a>';
  }
}

function afficherVideos(data) {
  const grid = document.getElementById('videos-grid');
  if (!grid) return;
  let html = '';
  (data.videos || []).forEach(function(video) {
    html += '<div class="col-md-6"><div class="video-item">' +
      '<div class="ratio ratio-16x9">' +
      '<iframe src="https://www.youtube-nocookie.com/embed/' + video.youtubeId + '" allowfullscreen loading="lazy"></iframe>' +
      '</div><div class="p-3"><h5 class="mb-1">' + (video.titre || '') + '</h5>' +
      '<p class="text-muted small mb-0">' + (video.description || '') + '</p></div></div></div>';
  });
  grid.innerHTML = html;
}

function afficherAudios(data) {
  const grid = document.getElementById('audios-grid');
  if (!grid) return;
  let html = '';
  (data.audios || []).forEach(function(audio) {
    html += '<div class="col-md-6"><div class="audio-item">' +
      '<h5>' + (audio.titre || '') + '</h5>' +
      '<p class="text-muted small">' + (audio.description || '') + '</p>' +
      '<audio controls style="width:100%">' +
      '<source src="' + audio.src + '" type="audio/mpeg">' +
      '</audio></div></div>';
  });
  grid.innerHTML = html;
}

function afficherActivites(data) {
  const grid = document.getElementById('activites-grid');
  if (!grid) return;
  let html = '';
  (data.activites || []).forEach(function(activite) {
    html += '<div class="col-md-6"><div class="activite-card">' +
      '<div class="date">' + (activite.date || '') + '</div>' +
      '<h5 class="mt-2">' + (activite.titre || '') + '</h5>' +
      '<p class="mb-0">' + (activite.description || '') + '</p></div></div>';
  });
  grid.innerHTML = html;
}

function afficherSacrements(data) {
  const el = document.getElementById('sacrements-content');
  if (!el) return;
  let html = '';
  (data.sacrements || []).forEach(function(s) {
    html += '<div class="sacrement-item">' +
      '<div class="sacrement-icon">*</div>' +
      '<div class="sacrement-info"><h5>' + (s.type || '') + '</h5>' +
      '<small>' + (s.date || '') + ' - ' + (s.lieu || '') + '</small></div></div>';
  });
  el.innerHTML = html;
}

function afficherPublications(data) {
  const grid = document.getElementById('publications-grid');
  if (!grid) return;
  let html = '';
  (data.publications || []).forEach(function(pub) {
    html += '<div class="col-md-6"><div class="publication-card">' +
      '<span class="type-badge">' + (pub.type || 'Article') + '</span>' +
      '<h5>' + (pub.titre || '') + '</h5>' +
      '<p class="text-muted small">' + (pub.date || '') + '</p>' +
      '<p>' + (pub.description || '') + '</p></div></div>';
  });
  grid.innerHTML = html;
}

function afficherTelechargements(data) {
  const grid = document.getElementById('telechargements-grid');
  if (!grid) return;
  let html = '';
  (data.fichiers || []).forEach(function(f) {
    html += '<div class="col-md-6"><a href="' + f.src + '" download class="download-card">' +
      '<div class="download-icon">+</div>' +
      '<div class="download-info"><h5>' + (f.titre || '') + '</h5>' +
      '<small>' + (f.description || '') + '</small></div></a></div>';
  });
  grid.innerHTML = html;
}

function afficherTemoignages(data) {
  const grid = document.getElementById('temoignages-grid');
  if (!grid) return;
  let html = '';
  (data.temoignages || []).forEach(function(t) {
    html += '<div class="col-md-6"><div class="temoignage-card">' +
      '<p>' + (t.message || '') + '</p>' +
      '<footer>- ' + (t.auteur || '') + (t.fonction ? ', ' + t.fonction : '') + '</footer>' +
      '</div></div>';
  });
  grid.innerHTML = html;
}

function afficherArbre(data) {
  const el = document.getElementById('arbre-content');
  if (!el) return;
  let html = '<div class="arbre-placeholder"><h4>Arbre genealogique</h4>' +
    '<p>La visualisation interactive sera disponible prochainement.</p>';
  if (data.membres && data.membres.length > 0) {
    html += '<ul class="list-unstyled text-start mt-4">';
    data.membres.forEach(function(m) {
      html += '<li><strong>' + m.nom + '</strong> - ' + (m.relation || '') + '</li>';
    });
    html += '</ul>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function afficherProgramme(data) {
  const el = document.getElementById('programme-content');
  if (!el) return;
  let html = '';
  if (data.titre) html += '<h3 class="text-center mb-4">' + data.titre + '</h3>';
  if (data.date || data.lieu) {
    html += '<p class="text-center mb-4">' +
      (data.date ? '<strong>' + data.date + '</strong>' : '') +
      (data.lieu ? ' - ' + data.lieu : '') + '</p>';
  }
  (data.etapes || []).forEach(function(e) {
    html += '<div class="programme-item">' +
      '<div class="heure">' + (e.heure || '') + '</div>' +
      '<div><div class="titre">' + (e.titre || '') + '</div>' +
      (e.lieu ? '<div class="lieu">' + e.lieu + '</div>' : '') +
      '</div></div>';
  });
  el.innerHTML = html;
}

function afficherHommages(data) {
  const grid = document.getElementById('hommages-grid');
  if (!grid) return;
  let html = '';
  (data.hommages || []).forEach(function(h) {
    html += '<div class="col-md-6"><div class="hommage-card">' +
      '<p class="fst-italic">"' + (h.message || '') + '"</p>' +
      '<div class="mt-3"><div class="auteur">' + (h.auteur || '') + '</div>' +
      '<div class="fonction">' + (h.fonction || '') + '</div></div></div></div>';
  });
  grid.innerHTML = html;
}

function afficherFAQ(data) {
  const el = document.getElementById('faq-accordion');
  if (!el) return;
  let html = '';
  (data.questions || []).forEach(function(q, i) {
    html += '<div class="accordion-item"><h2 class="accordion-header">' +
      '<button class="accordion-button ' + (i > 0 ? 'collapsed' : '') + '" type="button" data-bs-toggle="collapse" data-bs-target="#faq-' + i + '">' +
      (q.question || '') + '</button></h2>' +
      '<div id="faq-' + i + '" class="accordion-collapse collapse ' + (i === 0 ? 'show' : '') + '" data-bs-parent="#faq-accordion">' +
      '<div class="accordion-body">' + (q.reponse || '') + '</div></div></div>';
  });
  el.innerHTML = html;
}

function afficherCondoleances() {
  const data = APP.donnees.condoleances || { messages: [] };
  const list = document.getElementById('condoleances-list');
  if (!list) return;

  if (!data.messages || data.messages.length === 0) {
    list.innerHTML = '<p class="text-center text-muted">Soyez le premier a laisser un message.</p>';
    return;
  }

  let html = '';
  data.messages.forEach(function(m) {
    const initiale = (m.nom || '?').charAt(0).toUpperCase();
    html += '<div class="condoleance-item">' +
      '<div class="condoleance-avatar">' + initiale + '</div>' +
      '<div><div class="nom">' + (m.nom || '') + '</div>' +
      '<p class="mb-1">' + (m.message || '') + '</p>' +
      '<div class="date">' + (m.date || '') + '</div></div></div>';
  });
  list.innerHTML = html;
}

// ============================================
// 10. CONFIGURER LES INTERACTIONS
// ============================================
function configurerInteractions() {
  const backBtn = document.getElementById('back-to-top');
  if (backBtn) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 500) {
        backBtn.classList.remove('d-none');
      } else {
        backBtn.classList.add('d-none');
      }
    });
  }

  const formCond = document.getElementById('condoleances-form');
  if (formCond) {
    formCond.addEventListener('submit', function(e) {
      e.preventDefault();
      const nom = document.getElementById('cond-name').value;
      const message = document.getElementById('cond-message').value;
      if (!nom || !message) return;
      alert('Merci pour votre message. Il sera publie apres validation.');
      formCond.reset();
    });
  }

  const langSel = document.getElementById('language-selector');
  if (langSel) langSel.value = APP.langue;
}

// ============================================
// 11. MASQUER LE CHARGEMENT
// ============================================
function masquerChargement() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    setTimeout(function() { overlay.remove(); }, 500);
  }
}

// ============================================
// 12. AFFICHER UNE ERREUR
// ============================================
function afficherErreur(message) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.innerHTML = '<div class="text-center text-danger p-4">' +
      '<h4>Erreur</h4><p>' + message + '</p>' +
      '<p class="small">Verifiez la console (F12) pour plus de details.</p></div>';
  }
}

// ============================================
// 13. CHANGER DE LANGUE
// ============================================
async function changeLanguage(langue) {
  APP.langue = langue;
  localStorage.setItem('epc-langue', langue);
  document.documentElement.lang = langue;
  await chargerTraductions();
  appliquerTraductions();
  genererNavigation();
}

// ============================================
// 14. PARTAGE SOCIAL
// ============================================
function shareOn(reseau) {
  const url = encodeURIComponent(window.location.href);
  const titre = encodeURIComponent(document.title);
  let link = '';
  switch (reseau) {
    case 'facebook': link = 'https://www.facebook.com/sharer/sharer.php?u=' + url; break;
    case 'whatsapp': link = 'https://wa.me/?text=' + titre + '%20' + url; break;
    case 'twitter': link = 'https://twitter.com/intent/tweet?text=' + titre + '&url=' + url; break;
    case 'email': link = 'mailto:?subject=' + titre + '&body=' + url; break;
  }
  if (link) window.open(link, '_blank');
}

function copyLink() {
  navigator.clipboard.writeText(window.location.href).then(function() {
    alert('Lien copie dans le presse-papiers !');
  });
}

// ============================================
// 15. MODAL MEDIA
// ============================================
function openMediaModal(src, type, titre) {
  const modalBody = document.getElementById('mediaModalBody');
  const modalTitle = document.getElementById('mediaModalTitle');
  if (!modalBody || !modalTitle) return;

  modalTitle.textContent = titre || 'Media';

  if (type === 'image') {
    modalBody.innerHTML = '<img src="' + src + '" class="img-fluid" alt="' + titre + '">';
  } else if (type === 'video') {
    modalBody.innerHTML = '<div class="ratio ratio-16x9"><iframe src="' + src + '" allowfullscreen></iframe></div>';
  }

  new bootstrap.Modal(document.getElementById('mediaModal')).show();
}

/* ============================================
   FIN DU SCRIPT.JS
   ============================================ */
