/* TintaJunta · Internacionalización ES/EN
   - Detección automática con navigator.language ('en*' → inglés)
   - Preferencia guardada en localStorage ('tj_ui_lang')
   - t('clave', {var}) con interpolación {var}
   - Textos estáticos: data-i18n / data-i18n-html / data-i18n-ph / data-i18n-title
   - Cambio en vivo: setLang('en') → evento 'uilang' (app.js re-renderiza) */
'use strict';

const I18N = {
es: {
/* ---------- meta ---------- */
docTitle: 'TintaJunta · Sala de lectura en vivo',
/* ---------- header ---------- */
menuTitle: 'Menú',
searchTitle: 'Buscar',
liveLong: ' Sala en vivo',
liveShort: ' Sala',
loginTitle: 'Entrar con Google',
loginLong: ' Entrar',
myProfile: '👤 Mi perfil',
logoutBtn: '↩ Salir',
langBtnTitle: 'Idioma · Language',
/* ---------- drawer ---------- */
dwLibrary: '📚 Biblioteca',
dwWrite: '✍️ Escribir',
dwLive: '⚡ Sala en vivo',
dwPublish: '＋ Publicar libro',
dwAd: '📢 Anunciar',
dwAch: '🏆 Mis logros',
dwProfile: '👤 Mi perfil',
dwGoogle: '🔐 Entrar con Google',
dwVerify: '✅ Verificaciones',
dwAdmin: '🛡️ Revisión',
dwAdminN: '🛡️ Revisión ({n})',
dwFeedback: '🐛 Reportar problema',
dwTheme: '{icon} Tema',
/* ---------- buscador ---------- */
searchPh: 'Buscar por título o autor…',
/* ---------- seguir leyendo ---------- */
secContinue: '📖 Seguir leyendo',
continueCta: 'Seguir leyendo →',
/* ---------- pills ---------- */
pillTodos: 'Todos',
pillGratis: 'Gratis',
pillDestacados: 'Destacados',
pillNuevos: 'Nuevos',
pillPopulares: 'Populares',
langFilterAll: '🌍 Idioma: Todos',
rowTap: 'Toca para desplazar',
/* ---------- secciones ---------- */
secDestacados: '⭐ Destacados',
secDestacadosSub: 'Los libros más visibles de la portada.',
secRecomendados: '📚 Recomendados',
secClassics: '📜 Clásicos gratis',
secClassicsSub: 'Obras de dominio público — gratis para todos, sin creador.',
secNew: '✨ Novedades',
secNewSub: 'Los últimos clásicos que llegaron — cada mes hay nuevos.',
newBadge: 'NUEVO',
secMarquee: 'La biblioteca en movimiento',
marqueeTitle: 'Pausar / seguir',
secAds: '🛍️ Para leer mejor',
adsTag: 'Anuncios',
secAdsSub: 'Anuncios pagados: solo aparecen en este espacio, nunca interrumpen tu lectura.',
secAff: '🔗 Recomendados',
affTag: 'Afiliados',
secAffSub: 'Lo que usamos y recomendamos para leer mejor. Si compras, nos apoyas sin pagar de más.',
adsensePh: 'Espacio publicitario',
secKi: '🦁 Conoce a Ki',
secKiSub: 'La mascota de TintaJunta: te acompaña a convertir tus ideas en realidad.',
kiBadge: 'Mascota oficial',
kiOriginalT: 'Ki original',
kiOriginalD: 'El guía: con su pluma fuente te acompaña a crear, leer y marcar tus ideas.',
kiVaqueroT: 'Ki vaquero',
kiVaqueroD: 'El que impulsa: deja de solo pensar tus ideas y sal a hacerlas realidad.',
kiBallenaT: 'Ki ballena',
kiBallenaD: 'La imaginación: sumérgete en los libros y descubre mundos nuevos.',
},
en: {
/* ---------- meta ---------- */
docTitle: 'TintaJunta · Live reading room',
/* ---------- header ---------- */
menuTitle: 'Menu',
searchTitle: 'Search',
liveLong: ' Live room',
liveShort: ' Room',
loginTitle: 'Sign in with Google',
loginLong: ' Sign in',
myProfile: '👤 My profile',
logoutBtn: '↩ Log out',
langBtnTitle: 'Idioma · Language',
/* ---------- drawer ---------- */
dwLibrary: '📚 Library',
dwWrite: '✍️ Write',
dwLive: '⚡ Live room',
dwPublish: '＋ Publish book',
dwAd: '📢 Advertise',
dwAch: '🏆 My achievements',
dwProfile: '👤 My profile',
dwGoogle: '🔐 Sign in with Google',
dwVerify: '✅ Verifications',
dwAdmin: '🛡️ Review',
dwAdminN: '🛡️ Review ({n})',
dwFeedback: '🐛 Report an issue',
dwTheme: '{icon} Theme',
/* ---------- buscador ---------- */
searchPh: 'Search by title or author…',
/* ---------- seguir leyendo ---------- */
secContinue: '📖 Continue reading',
continueCta: 'Continue reading →',
/* ---------- pills ---------- */
pillTodos: 'All',
pillGratis: 'Free',
pillDestacados: 'Featured',
pillNuevos: 'New',
pillPopulares: 'Popular',
langFilterAll: '🌍 Language: All',
rowTap: 'Tap to scroll',
/* ---------- secciones ---------- */
secDestacados: '⭐ Featured',
secDestacadosSub: 'The most visible books on the front page.',
secRecomendados: '📚 Recommended',
secClassics: '📜 Free classics',
secClassicsSub: 'Public domain works — free for everyone, no creator.',
secNew: '✨ New arrivals',
secNewSub: 'The latest classics to arrive — new ones every month.',
newBadge: 'NEW',
secMarquee: 'The library in motion',
marqueeTitle: 'Pause / play',
secAds: '🛍️ Read better',
adsTag: 'Ads',
secAdsSub: 'Paid ads: they only appear in this space, never interrupting your reading.',
secAff: '🔗 Recommended',
affTag: 'Affiliates',
secAffSub: 'What we use and recommend for better reading. If you buy, you support us at no extra cost.',
adsensePh: 'Advertisement space',
secKi: '🦁 Meet Ki',
secKiSub: 'The TintaJunta mascot: helping you turn your ideas into reality.',
kiBadge: 'Official mascot',
kiOriginalT: 'Original Ki',
kiOriginalD: 'The guide: with his fountain pen, he joins you in creating, reading and marking your ideas.',
kiVaqueroT: 'Cowboy Ki',
kiVaqueroD: 'The driver: stop just thinking about your ideas and go make them real.',
kiBallenaT: 'Whale Ki',
kiBallenaD: 'The imagination: dive into books and discover new worlds.',
},
};
/* ---------- sala en vivo (portada) ---------- */
I18N.es.liveH = '⚡ Sala en vivo';
I18N.es.liveSub = 'Entra con tu nombre, sin cuenta. Lee y marca junto a otros en tiempo real.';
I18N.es.yourName = 'Tu nombre';
I18N.es.yourNamePh = '¿Cómo te llamas?';
I18N.es.yourInk = 'Tu color de tinta';
I18N.es.teacherCheck = '🎓 Soy el profesor — mi tinta siempre es <b>negra</b>';
I18N.es.enterLive = '⚡ Entrar a la sala en vivo';
I18N.es.publishCta = '＋ Publicar un libro';
I18N.es.advertiseCta = '📢 Anunciar producto';
I18N.es.noAccountNote = 'Sin cuenta para leer. Los libros que publiques los verá todo el que entre.';
/* ---------- footer ---------- */
I18N.es.footTag = 'Lee juntos, marca con tu tinta.';
I18N.es.footBy = 'Creado por <b>Lenyn Escobar</b> · CEO de TintaJunta';
I18N.es.footReport = '🐛 Reportar problema';
I18N.es.footSponsorSub = 'Comunidad patrocinadora · 8,400+ miembros';
I18N.es.footSponsors = 'Patrocinado por <b>Best Offer</b> — 8,400+ miembros comprando y vendiendo';
I18N.es.footRoomCodePh = 'Código de sala';
I18N.es.footRoomGo = 'Entrar →';
/* ---------- escribir ---------- */
I18N.es.wrKicker = 'TINTAJUNTA · ESCRIBE';
I18N.es.wrH1 = '✍️ Escribir';
I18N.es.wrSub = 'Tu página en blanco. Guarda tus textos y léelos cuando quieras.';
I18N.es.wrTitle = 'Título';
I18N.es.wrTitlePh = 'Título de tu escrito';
I18N.es.wrText = 'Tu texto';
I18N.es.wrTextPh = 'Escribe aquí…';
I18N.es.wrSave = 'Guardar escrito';
I18N.es.wrMine = 'Mis escritos';
I18N.es.wrEmpty = 'Aún no tienes escritos.';
I18N.es.wrSaved = 'Escrito guardado ✅';
I18N.es.wrNeedTitle = 'Ponle título y texto';
I18N.es.readClose = 'Cerrar';
/* ---------- publicar libro ---------- */
I18N.es.pubTitle = 'Publicar un libro';
I18N.es.pubTitleLbl = 'Título';
I18N.es.pubTitlePh = 'El título de tu libro';
I18N.es.pubPriceLbl = 'Precio (USD, 0 = gratis · mínimo $1.99)';
I18N.es.pubAgeLbl = 'Clasificación de edad';
I18N.es.pubAgeAll = 'Todos los públicos';
I18N.es.pubAge13 = '+13 años';
I18N.es.pubAge18 = '+18 años (contenido adulto)';
I18N.es.pubTextLbl = 'Texto del libro';
I18N.es.pubTextPh = 'Pega aquí el texto. Separa los párrafos con una línea en blanco.';
I18N.es.pubCoverLbl = 'Portada * (obligatoria, imagen máx 2MB)';
I18N.es.pubCoverToggle = '🎨 O crea tu portada aquí';
I18N.es.pubCoverHint = 'Vista previa — así se verá en la biblioteca';
I18N.es.pubPalette = 'Paleta de colores';
I18N.es.pubTexture = 'Textura';
I18N.es.patDots = '· Puntos';
I18N.es.patLines = '≡ Líneas';
I18N.es.patPlain = '— Lisa';
I18N.es.pubCoverUse = '✅ Usar esta portada';
I18N.es.pubYourTitle = 'Tu título';
I18N.es.pubYourName = 'Tu nombre';
I18N.es.pubPhotosLbl = 'Fotos del libro (opcional, JPG/PNG/WebP máx 2MB c/u)';
I18N.es.pubRulesTitle = '⚠️ Antes de publicar, recuerda lo que NO puedes hacer:';
I18N.es.pubRule1 = '❌ Publicar libros que no sean tuyos';
I18N.es.pubRule2 = '❌ Subir libros comerciales o con derechos de autor';
I18N.es.pubRule3 = '❌ Subir libros de dominio público como si fueran tuyos';
I18N.es.pubRule4 = '❌ Publicar sin portada (es obligatoria)';
I18N.es.pubRule5 = '❌ Copiar el contenido de otro creador';
I18N.es.pubRulesNote = 'Solo puedes publicar tus propios libros originales. Si rompes estas reglas, tu libro será eliminado.';
I18N.es.pubContract = '<b>📝 Contrato de publicación:</b> Declaro que este libro es de mi autoría original y estoy consciente de todas las prohibiciones anteriores. Acepto que si cometo alguna falta, <b>pierdo mi cuenta</b> y mis libros serán eliminados sin reembolso.';
I18N.es.btnCancel = 'Cancelar';
I18N.es.pubBtn = 'Publicar';
I18N.es.pubNeedTitleText = 'Ponle título y texto a tu libro';
I18N.es.pubNeedContract = 'Debes aceptar el contrato de publicación';
I18N.es.pubPriceMin = 'El precio mínimo es $1.99, o publícalo gratis';
I18N.es.pubCoverReq = 'La portada es obligatoria — súbela o créala con 🎨';
I18N.es.pubTooLong = '⚠️ Máximo 500 párrafos por libro — acorta el texto';
I18N.es.pubMatch = '⚠️ Este texto coincide {n}% con otro libro — debe ser original';
I18N.es.pubErr = 'No se pudo publicar el libro';
I18N.es.pubSentReview = '📝 Libro enviado a revisión — saldrá en la biblioteca cuando sea aprobado';
I18N.es.pubOk = '¡Libro publicado!';
I18N.es.pubCoverType = 'La portada debe ser JPG, PNG, WebP o GIF';
I18N.es.pubCoverSize = 'La portada no puede pasar de 2MB';
I18N.es.pubCoverOk = '✅ Portada lista — se usará al publicar';
I18N.es.pubCoverCreated = '✅ Portada creada — lista para publicar';
I18N.es.pubCoverGen = '⏳ Generando portada…';
I18N.es.pubPhotoType = 'La foto debe ser JPG, PNG o WebP';
I18N.es.pubPhotoSize = 'La foto no puede pasar de 2MB';
I18N.es.pubCoverUploadFail = 'Libro publicado, pero la portada no se pudo subir';
I18N.es.pubPhotosUploadFail = 'Libro publicado, pero algunas fotos no se pudieron subir';
I18N.es.photoAlt = 'Foto del libro';
/* ---------- destacar ---------- */
I18N.es.featTitle = '⭐ Destacar en portada';
I18N.es.featDesc = 'Tu libro aparece primero en la portada, en la sección Destacados.';
I18N.es.paySecure = 'Pago seguro con tarjeta (Stripe).';
I18N.es.featPay = 'Pagar y destacar';
I18N.es.planDay = 'Por día';
I18N.es.planWeek = 'Por semana';
I18N.es.planMonth = 'Por mes';
I18N.es.featOk = '⭐ ¡Tu libro está destacado en portada!';
/* ---------- anunciar ---------- */
I18N.es.adTitle = '📢 Anunciar producto';
I18N.es.adDesc = 'Tu producto aparece en la fila "🛍️ Para leer mejor" de la portada.';
I18N.es.adNameLbl = 'Nombre del producto';
I18N.es.adNamePh = 'Ej. Lentes filtro luz azul';
I18N.es.adUrlLbl = 'Enlace de tu tienda (donde compran)';
I18N.es.adUrlPh = 'https://tutienda.com/producto';
I18N.es.adPhotoLbl = 'Foto del producto (JPG/PNG/WebP, máx 2MB)';
I18N.es.adEmojiLbl = 'Emoji';
I18N.es.adBadgeLbl = 'Insignia';
I18N.es.adBadgeBest = '🔥 Más vendido';
I18N.es.adBadgeFamous = '⭐ Famoso';
I18N.es.adPlanLbl = 'Plan';
I18N.es.adPay = 'Pagar y publicar';
I18N.es.adNeedName = 'Ponle un nombre a tu producto';
I18N.es.adNeedUser = 'Escribe tu nombre primero';
I18N.es.adPayTitle = 'Anunciar "{name}"';
I18N.es.productWord = 'producto';
I18N.es.adPayErr = 'No se pudo completar el pago';
I18N.es.adOk = '📢 ¡Tu anuncio está en portada!';
I18N.es.adRenewed = '🔄 ¡Anuncio renovado!';
I18N.es.adRenew = '🔄 Renovar anuncio';
I18N.es.adHere = 'Anunciar aquí';
I18N.es.adNone = 'Pronto habrá anuncios aquí.';
I18N.es.adNoStore = 'Este anunciante aún no tiene tienda vinculada';
I18N.es.adBestFamous = 'Lo más famoso y más vendido para tu momento de lectura.';
I18N.es.adFamous = 'Lo más famoso para leer mejor';
I18N.es.adAffNote = '{price} · Enlace de afiliado · Toca para ver';
I18N.es.adAffNoCfg = 'Enlace de afiliado no configurado';
I18N.es.adAffCta = 'Ver en Amazon →';
I18N.es.affDescLentes = 'Filtran la luz azul de pantallas y lámparas: menos cansancio en los ojos en lecturas largas.';
I18N.es.affDescAudifonos = 'Escucha audiolibros y música sin cables, con sonido claro para concentrarte mejor.';
I18N.es.affDescLampara = 'Luz cálida y ajustable para leer de noche sin molestar a nadie ni forzar la vista.';
I18N.es.affDescEreader = 'Lleva miles de libros en el bolsillo con pantalla que no cansa los ojos, como papel.';
I18N.es.affDescTaza = 'Mantiene tu café o té caliente por horas mientras lees, sin derrames.';
I18N.es.affDescCojin = 'Soporte cómodo para leer en la cama o el sofá sin cansar brazos ni cuello.';
I18N.es.affDescBeats = 'Sonido premium con cancelación de ruido: sumérgete en audiolibros sin distracciones.';
I18N.es.affDescMotoG15 = 'Pantalla amplia y batería que dura todo el día para leer donde sea, sin interrupciones.';
I18N.es.affDescMotoG56 = 'Potencia 5G y pantalla fluida para leer, escuchar audiolibros y navegar sin esperas.';
I18N.es.affDescPixelBuds = 'Audio claro y ajuste cómodo para disfrutar audiolibros por horas.';
I18N.es.adCommunity = '⭐ Comunidad';
I18N.es.adOpenGroup = 'Abrir grupo';
I18N.es.adBestOfferSub = 'Compra y vende con más de 8,400 miembros. El grupo de nuestra comunidad.';
I18N.es.adDaysLeft = '⏳ {n} día{ps} en portada';
/* ---------- bienvenida ---------- */
I18N.es.welTitle = '👋 Bienvenido a TintaJunta';
I18N.es.welSub = 'Lee libros <b>junto a otros, en vivo</b>.';
I18N.es.wel1 = '📚 <b>Lee</b> — abre un libro y léelo a tu ritmo.';
I18N.es.wel2 = '🎨 <b>Marca</b> — subraya con tu tinta y deja notas que todos ven.';
I18N.es.wel3 = '✍️ <b>Escribe</b> — guarda tus propios textos.';
I18N.es.wel4 = '📚 Lee a tu ritmo — abre cualquier libro y empieza. Todo gratis.';
I18N.es.welOk = 'Entendido';
I18N.es.tapLiveRoom = '🔴 Toca "Sala en vivo" para leer juntos en tiempo real';
I18N.en.liveH = '⚡ Live room';
I18N.en.liveSub = 'Join with your name, no account needed. Read and highlight with others in real time.';
I18N.en.yourName = 'Your name';
I18N.en.yourNamePh = 'What is your name?';
I18N.en.yourInk = 'Your ink color';
I18N.en.teacherCheck = '🎓 I am the teacher — my ink is always <b>black</b>';
I18N.en.enterLive = '⚡ Enter the live room';
I18N.en.publishCta = '＋ Publish a book';
I18N.en.advertiseCta = '📢 Advertise a product';
I18N.en.noAccountNote = 'No account needed to read. Everyone who visits will see the books you publish.';
I18N.en.footTag = 'Read together, mark with your ink.';
I18N.en.footBy = 'Created by <b>Lenyn Escobar</b> · CEO of TintaJunta';
I18N.en.footReport = '🐛 Report an issue';
I18N.en.footSponsorSub = 'Sponsoring community · 8,400+ members';
I18N.en.footSponsors = 'Sponsored by <b>Best Offer</b> — 8,400+ members buying and selling';
I18N.en.footRoomCodePh = 'Room code';
I18N.en.footRoomGo = 'Join →';
I18N.en.wrKicker = 'TINTAJUNTA · WRITE';
I18N.en.wrH1 = '✍️ Write';
I18N.en.wrSub = 'Your blank page. Save your texts and read them whenever you want.';
I18N.en.wrTitle = 'Title';
I18N.en.wrTitlePh = 'Title of your piece';
I18N.en.wrText = 'Your text';
I18N.en.wrTextPh = 'Write here…';
I18N.en.wrSave = 'Save piece';
I18N.en.wrMine = 'My pieces';
I18N.en.wrEmpty = 'You have no pieces yet.';
I18N.en.wrSaved = 'Piece saved ✅';
I18N.en.wrNeedTitle = 'Give it a title and some text';
I18N.en.readClose = 'Close';
I18N.en.pubTitle = 'Publish a book';
I18N.en.pubTitleLbl = 'Title';
I18N.en.pubTitlePh = 'Your book’s title';
I18N.en.pubPriceLbl = 'Price (USD, 0 = free · minimum $1.99)';
I18N.en.pubAgeLbl = 'Age rating';
I18N.en.pubAgeAll = 'All audiences';
I18N.en.pubAge13 = 'Ages 13+';
I18N.en.pubAge18 = '18+ (adult content)';
I18N.en.pubTextLbl = 'Book text';
I18N.en.pubTextPh = 'Paste your text here. Separate paragraphs with a blank line.';
I18N.en.pubCoverLbl = 'Cover * (required, image max 2MB)';
I18N.en.pubCoverToggle = '🎨 Or create your cover here';
I18N.en.pubCoverHint = 'Preview — this is how it will look in the library';
I18N.en.pubPalette = 'Color palette';
I18N.en.pubTexture = 'Texture';
I18N.en.patDots = '· Dots';
I18N.en.patLines = '≡ Lines';
I18N.en.patPlain = '— Plain';
I18N.en.pubCoverUse = '✅ Use this cover';
I18N.en.pubYourTitle = 'Your title';
I18N.en.pubYourName = 'Your name';
I18N.en.pubPhotosLbl = 'Book photos (optional, JPG/PNG/WebP max 2MB each)';
I18N.en.pubRulesTitle = '⚠️ Before publishing, remember what you may NOT do:';
I18N.en.pubRule1 = '❌ Publish books that are not yours';
I18N.en.pubRule2 = '❌ Upload commercial or copyrighted books';
I18N.en.pubRule3 = '❌ Upload public-domain books as if they were yours';
I18N.en.pubRule4 = '❌ Publish without a cover (it is required)';
I18N.en.pubRule5 = '❌ Copy another creator’s content';
I18N.en.pubRulesNote = 'You may only publish your own original books. If you break these rules, your book will be removed.';
I18N.en.pubContract = '<b>📝 Publishing agreement:</b> I declare this book is my original work and I am aware of all the prohibitions above. I accept that if I break them, I <b>lose my account</b> and my books will be removed without refund.';
I18N.en.btnCancel = 'Cancel';
I18N.en.pubBtn = 'Publish';
I18N.en.pubNeedTitleText = 'Give your book a title and text';
I18N.en.pubNeedContract = 'You must accept the publishing agreement';
I18N.en.pubPriceMin = 'Minimum price is $1.99, or publish it free';
I18N.en.pubCoverReq = 'A cover is required — upload one or create it with 🎨';
I18N.en.pubTooLong = '⚠️ Maximum 500 paragraphs per book — shorten the text';
I18N.en.pubMatch = '⚠️ This text matches {n}% of another book — it must be original';
I18N.en.pubErr = 'Could not publish the book';
I18N.en.pubSentReview = '📝 Book sent for review — it will appear in the library once approved';
I18N.en.pubOk = 'Book published!';
I18N.en.pubCoverType = 'Cover must be JPG, PNG, WebP or GIF';
I18N.en.pubCoverSize = 'Cover cannot exceed 2MB';
I18N.en.pubCoverOk = '✅ Cover ready — it will be used when publishing';
I18N.en.pubCoverCreated = '✅ Cover created — ready to publish';
I18N.en.pubCoverGen = '⏳ Generating cover…';
I18N.en.pubPhotoType = 'Photo must be JPG, PNG or WebP';
I18N.en.pubPhotoSize = 'Photo cannot exceed 2MB';
I18N.en.pubCoverUploadFail = 'Book published, but the cover could not be uploaded';
I18N.en.pubPhotosUploadFail = 'Book published, but some photos could not be uploaded';
I18N.en.photoAlt = 'Book photo';
I18N.en.featTitle = '⭐ Feature on the front page';
I18N.en.featDesc = 'Your book appears first on the front page, in the Featured section.';
I18N.en.paySecure = 'Secure card payment (Stripe).';
I18N.en.featPay = 'Pay and feature';
I18N.en.planDay = 'Per day';
I18N.en.planWeek = 'Per week';
I18N.en.planMonth = 'Per month';
I18N.en.featOk = '⭐ Your book is now featured on the front page!';
I18N.en.adTitle = '📢 Advertise a product';
I18N.en.adDesc = 'Your product appears in the "🛍️ Read better" row on the front page.';
I18N.en.adNameLbl = 'Product name';
I18N.en.adNamePh = 'E.g. Blue-light glasses';
I18N.en.adUrlLbl = 'Your store link (where they buy)';
I18N.en.adUrlPh = 'https://yourstore.com/product';
I18N.en.adPhotoLbl = 'Product photo (JPG/PNG/WebP, max 2MB)';
I18N.en.adEmojiLbl = 'Emoji';
I18N.en.adBadgeLbl = 'Badge';
I18N.en.adBadgeBest = '🔥 Best seller';
I18N.en.adBadgeFamous = '⭐ Famous';
I18N.en.adPlanLbl = 'Plan';
I18N.en.adPay = 'Pay and publish';
I18N.en.adNeedName = 'Give your product a name';
I18N.en.adNeedUser = 'Write your name first';
I18N.en.adPayTitle = 'Advertise "{name}"';
I18N.en.productWord = 'product';
I18N.en.adPayErr = 'Could not complete the payment';
I18N.en.adOk = '📢 Your ad is live on the front page!';
I18N.en.adRenewed = '🔄 Ad renewed!';
I18N.en.adRenew = '🔄 Renew ad';
I18N.en.adHere = 'Advertise here';
I18N.en.adNone = 'Ads coming soon.';
I18N.en.adNoStore = 'This advertiser has no linked store yet';
I18N.en.adBestFamous = 'The most famous and best-selling picks for your reading time.';
I18N.en.adFamous = 'Most famous for better reading';
I18N.en.adAffNote = '{price} · Affiliate link · Tap to view';
I18N.en.adAffNoCfg = 'Affiliate link not configured';
I18N.en.adAffCta = 'View on Amazon →';
I18N.en.affDescLentes = 'Filter blue light from screens and lamps: less eye strain during long reading sessions.';
I18N.en.affDescAudifonos = 'Listen to audiobooks and music wirelessly, with clear sound to focus better.';
I18N.en.affDescLampara = 'Warm, adjustable light for reading at night without disturbing anyone or straining your eyes.';
I18N.en.affDescEreader = 'Carry thousands of books in your pocket with a paper-like screen that is easy on the eyes.';
I18N.en.affDescTaza = 'Keeps your coffee or tea hot for hours while you read, spill-free.';
I18N.en.affDescCojin = 'Comfortable support for reading in bed or on the sofa without tiring your arms or neck.';
I18N.en.affDescBeats = 'Premium sound with noise cancellation: dive into audiobooks with zero distractions.';
I18N.en.affDescMotoG15 = 'Big display and all-day battery to read anywhere, without interruptions.';
I18N.en.affDescMotoG56 = '5G power and a smooth display for reading, audiobooks and browsing with no waiting.';
I18N.en.affDescPixelBuds = 'Clear audio and a comfortable fit to enjoy audiobooks for hours.';
I18N.en.adCommunity = '⭐ Community';
I18N.en.adOpenGroup = 'Open group';
I18N.en.adBestOfferSub = 'Buy and sell with 8,400+ members. Our community group.';
I18N.en.adDaysLeft = '⏳ {n} day{ps} featured';
I18N.en.welTitle = '👋 Welcome to TintaJunta';
I18N.en.welSub = 'Read books <b>together with others, live</b>.';
I18N.en.wel1 = '📚 <b>Read</b> — open a book and read at your own pace.';
I18N.en.wel2 = '🎨 <b>Mark</b> — highlight with your ink and leave notes everyone sees.';
I18N.en.wel3 = '✍️ <b>Write</b> — save your own texts.';
I18N.en.wel4 = '📚 Read at your own pace — open any book and start. All free.';
I18N.en.welOk = 'Got it';
I18N.en.tapLiveRoom = '🔴 Tap "Live room" to read together in real time';
/* ---------- comprar ---------- */
I18N.es.buySecureCreator = 'Pago seguro con tarjeta (Stripe). El creador recibe su parte.';
I18N.es.buySample = '📖 Muestra gratis';
I18N.es.buyShare = '📤';
I18N.es.buyShareTitle = 'Compartir este libro';
I18N.es.buyBtn = 'Comprar';
I18N.es.buyFor = 'Comprar por ';
I18N.es.buyForTitle = 'Comprar "{title}"';
I18N.es.sampleTitle = '📖 Muestra gratis';
I18N.es.sampleLiked = '¿Te gustó? El libro completo te espera.';
I18N.es.sampleBuy = 'Comprar libro';
I18N.es.sampleMissing = 'El creador aún no agregó texto de muestra.';
I18N.es.boughtTitle = '🎉 ¡Libro adquirido!';
I18N.es.boughtSub = 'Lo mejor de TintaJunta es leer <b>juntos</b>: cada quien marca con su tinta y todos ven las ideas en vivo.';
I18N.es.boughtInvite = '📤 Invitar amigos';
I18N.es.boughtRead = 'Leer ahora';
I18N.es.boughtRoom = '🔴 Crear sala en vivo';
I18N.es.boughtToast = '¡Libro adquirido!';
I18N.es.shareText = '📚 "{title}" de {author} — léelo conmigo en TintaJunta';
I18N.es.linkCopied = '📋 Enlace copiado — pégalo donde quieras';
I18N.es.buyRated18 = '"{title}" está clasificado +18 (contenido para adultos).';
/* ---------- pago ---------- */
I18N.es.payTitle = '💳 Pagar con tarjeta';
I18N.es.payNote = 'Pago seguro con Stripe. Modo de prueba: usa la tarjeta 4242 4242 4242 4242.';
I18N.es.payBtn = 'Pagar';
I18N.es.payCancelled = 'Pago cancelado';
I18N.es.payReceived = '✅ Pago recibido';
I18N.es.payConfirmErr = 'No se pudo confirmar el pago';
I18N.es.payFinalizeErr = 'No se pudo confirmar el pago';
/* ---------- logros ---------- */
I18N.es.achTitle = '🏆 Mis logros';
I18N.es.achSub = 'Tu nivel sube con cada libro vendido.';
I18N.es.achSubName = '{name} · tus logros como creador.';
I18N.es.achSubPlain = 'Tus logros como creador.';
I18N.es.achStats = '{sales} venta{s} · {books} libro{ps} · 💬 {notes} notas';
I18N.es.achBooksNotes = '{books} libro{ps} · 💬 {notes} notas';
I18N.es.achNext = 'A <b>{need}</b> venta{s} de <b>{emoji} {name}</b>';
I18N.es.achMax = '🏆 ¡Nivel máximo alcanzado!';
I18N.es.achLevelOf = ' · tu nivel sube con cada libro vendido.';
I18N.es.lvlCreator = 'Creador';
/* ---------- perfil creador ---------- */
I18N.es.kpVerified = 'Creador verificado';
I18N.es.kpVerifiedTitle = '✓';
I18N.es.kpAuthor = 'Autor · {n} libro{ps}';
I18N.es.kpLocation = 'Ubicación';
I18N.es.kpWebsite = 'Sitio web';
I18N.es.kpSince = 'Publicando desde';
I18N.es.kpSiteOfficial = '🌐 Sitio oficial';
I18N.es.kpAbout = 'Acerca de';
I18N.es.kpBooks = 'Libros';
I18N.es.kpReaders = 'Lectores';
I18N.es.kpNotes = 'Notas';
I18N.es.kpBooksOf = 'Libros de {name}';
I18N.es.kpEdit = '✏️ Editar mi perfil';
I18N.es.kpNoBooks = 'Aún no tiene libros publicados.';
I18N.es.kpLoading = 'Cargando perfil…';
I18N.es.kpErr = 'No se pudo cargar el perfil. Revisa tu conexión.';
I18N.es.kpEditTitle = 'Editar perfil';
I18N.es.kpCityPh = 'Ciudad, País';
I18N.es.kpAboutPh = 'Cuéntales a tus lectores quién eres…';
I18N.es.kpSaving = 'Guardando…';
I18N.es.kpSaved = 'Perfil actualizado ✅';
I18N.es.kpSaveBtn = '💾 Guardar';
I18N.es.kpOwnerOnly = 'Solo el dueño puede editar este perfil (entra con Google).';
I18N.es.kpPhotoHeavy = 'La foto es muy pesada (máx 2MB).';
I18N.es.kpPhotoType = 'La foto debe ser JPG, PNG, WebP o GIF';
I18N.es.kpNeedGoogle = 'Entra con Google para editar tu perfil.';
I18N.es.kpPhotoAlt = 'Foto de {name}';
I18N.es.kpCoverAlt = 'Portada de {title}';
I18N.es.levelTitle = 'Nivel de creador';
/* ---------- verificaciones ---------- */
I18N.es.verifTitle = '✅ Mis verificaciones';
I18N.es.verifSub = 'Completa tus verificaciones para generar confianza con tus lectores.';
I18N.es.vrfVerified = 'Verificado';
I18N.es.vrfInReview = 'En revisión';
I18N.es.vrfIdTitle = '🪪 Identidad';
I18N.es.vrfIdDesc = 'Confirma quién eres con tu nombre completo y documento.';
I18N.es.vrfIdNamePh = 'Nombre completo';
I18N.es.vrfIdHint = 'Cada libro que publicas pasa una revisión anti-plagio automática.';
I18N.es.vrfEmailTitle = '📧 Correo';
I18N.es.vrfEmailDesc = 'Confirma tu correo con el código que te mostramos.';
I18N.es.vrfCodePh = 'Código de 6 dígitos';
I18N.es.vrfPhoneTitle = '📱 Teléfono';
I18N.es.vrfPhoneDesc = 'Confirma tu número con el código que te mostramos.';
I18N.es.vrfBankTitle = '🏦 Cuenta bancaria';
I18N.es.vrfBankDesc = 'Para recibir tus pagos. La verifica el administrador.';
I18N.es.vrfBankRoutPh = 'Número de ruta';
I18N.es.vrfBankAcctPh = 'Número de cuenta';
I18N.es.vrfBankHint = 'Necesarios para tus pagos como creador.';
I18N.es.vrfTaxTitle = '🧾 Datos fiscales';
I18N.es.vrfTaxDesc = 'Necesarios para tus pagos como creador.';
I18N.es.vrfTaxNamePh = 'Nombre legal';
I18N.es.vrfTaxAddrPh = 'Dirección';
I18N.es.vrfTaxSsnPh = 'SSN (últimos 4)';
I18N.es.vrfSendReview = 'Enviar a revisión';
I18N.es.vrfSendCode = 'Enviar código';
I18N.es.vrfSendVerify = 'Enviar a verificación';
I18N.es.vrfSave = 'Guardar';
I18N.es.vrfChooseRating = 'Elige la clasificación al publicar: Todos, +13 o +18.';
I18N.es.vrfIdSent = '🪪 Identidad enviada a revisión';
I18N.es.vrfNeedId = 'Completa nombre y documento';
I18N.es.vrfCodeSent = 'Tu código (prototipo): ';
I18N.es.vrfBadEmail = 'Revisa el correo ingresado';
I18N.es.vrfBadPhone = 'Revisa el número ingresado';
I18N.es.vrfPhoneOk = '📱 Teléfono verificado';
I18N.es.vrfBankSent = '🏦 Datos enviados a verificación';
I18N.es.vrfTaxOk = '🧾 Datos fiscales guardados';
I18N.es.vrfNeedBank = 'Completa banco, ruta y cuenta';
I18N.es.vrfNeedFields = 'Completa todos los campos (SSN: 4 dígitos)';
I18N.es.vrfSaveErr = 'No se pudo guardar. Revisa tu conexión.';
/* ---------- admin ---------- */
I18N.es.admTitle = '🛡️ Revisión';
I18N.es.admSub = 'Pendientes de aprobación.';
I18N.es.admNoAccess = 'Sin acceso.';
I18N.es.admBooks = '📚 Libros en revisión ({n})';
I18N.es.admApprove = 'Aprobar';
I18N.es.admReject = 'Rechazar';
I18N.es.admBugs = '🐛 Reportes de fallos';
I18N.es.admNoReports = 'Sin reportes. 🎉';
I18N.es.admMarkRead = 'Marcar leído';
I18N.es.admRead = '👁️ Leído';
I18N.es.admVerifyCreator = '✔️ Creador verificado';
I18N.es.admCreatorNamePh = 'Nombre del creador';
I18N.es.admNeedCreator = 'Escribe el nombre del creador';
/* ---------- feedback ---------- */
I18N.es.fbTitle = '🐛 Reportar problema';
I18N.es.fbSub = 'Cuéntanos qué no funciona bien y lo arreglamos.';
I18N.es.fbWhat = '¿Qué no funciona?';
I18N.es.fbWhatPh = 'Describe el problema…';
I18N.es.fbPage = '¿En qué página estabas?';
I18N.es.fbName = 'Tu nombre (opcional)';
I18N.es.fbNamePh = 'Anónimo';
I18N.es.fbSend = 'Enviar reporte';
I18N.es.fbNeedMsg = 'Escribe qué no funciona.';
I18N.es.fbSent = '✅ Reporte enviado. ¡Gracias!';
I18N.es.fbErr = 'No se pudo enviar. Intenta de nuevo.';
I18N.es.fbOffline = 'Sin conexión. Intenta de nuevo.';
/* ---------- edad ---------- */
I18N.es.ageTitle = '🔞 Contenido para adultos';
I18N.es.ageText = 'Este libro está clasificado +18.';
I18N.es.ageBack = 'Volver';
I18N.es.ageConfirm = 'Soy mayor de edad — continuar';
/* ---------- cambiar libro ---------- */
I18N.es.sbTitle = '📚 Cambiar libro';
I18N.es.sbSub = 'Elige el texto que leerán todos en la sala.';
I18N.es.sbReading = 'Ya están leyendo este libro';
/* ---------- reseñas ---------- */
I18N.es.revTitle = '⭐ Dejar reseña';
I18N.es.revPh = 'Tu opinión (opcional)…';
I18N.es.revSave = 'Publicar reseña';
I18N.es.revLoading = 'Cargando reseñas…';
I18N.es.revEmpty = 'Aún no hay reseñas. ¡Sé el primero!';
I18N.es.revErr = 'No se pudieron cargar las reseñas.';
I18N.es.revThanks = '¡Gracias por tu reseña! ⭐';
I18N.es.revSaveErr = 'No se pudo guardar la reseña — revisa tu conexión';
I18N.es.revViewTitle = 'Ver / dejar reseña';
I18N.es.noReviews = '☆ Sin reseñas';
/* ---------- reportes ---------- */
I18N.es.repTitle = '🚩 Reportar libro';
I18N.es.repWhy = '¿Por qué rompe las reglas?';
I18N.es.repOtherPh = 'Describe el motivo…';
I18N.es.repSend = 'Enviar reporte';
I18N.es.repR1 = 'No es un libro original del autor';
I18N.es.repR2 = 'Tiene derechos de autor (es un libro comercial)';
I18N.es.repR3 = 'Es de dominio público';
I18N.es.repR4 = 'Contenido copiado de otro creador';
I18N.es.repROther = 'Otro motivo';
I18N.es.repNeedReason = 'Escribe el motivo del reporte';
I18N.es.repAlready = 'Ya reportaste este libro';
I18N.es.repSentN = 'Reporte enviado. Este libro ya tiene ';
I18N.es.repSentThanks = 'Reporte enviado. Gracias por cuidar la comunidad.';
I18N.es.repErr = 'No se pudo enviar el reporte — revisa tu conexión';
I18N.es.repBadge = '⚠️ Reportado por la comunidad';
I18N.es.repBtnTitle = 'Reportar este libro';
I18N.en.buySecureCreator = 'Secure card payment (Stripe). The creator gets their share.';
I18N.en.buySample = '📖 Free sample';
I18N.en.buyShare = '📤';
I18N.en.buyShareTitle = 'Share this book';
I18N.en.buyBtn = 'Buy';
I18N.en.buyFor = 'Buy for ';
I18N.en.buyForTitle = 'Buy "{title}"';
I18N.en.sampleTitle = '📖 Free sample';
I18N.en.sampleLiked = 'Did you like it? The full book is waiting.';
I18N.en.sampleBuy = 'Buy book';
I18N.en.sampleMissing = 'The creator has not added sample text yet.';
I18N.en.boughtTitle = '🎉 Book purchased!';
I18N.en.boughtSub = 'The best of TintaJunta is reading <b>together</b>: everyone marks with their own ink and all ideas appear live.';
I18N.en.boughtInvite = '📤 Invite friends';
I18N.en.boughtRead = 'Read now';
I18N.en.boughtRoom = '🔴 Create live room';
I18N.en.boughtToast = 'Book purchased!';
I18N.en.shareText = '📚 "{title}" by {author} — read it with me on TintaJunta';
I18N.en.linkCopied = '📋 Link copied — paste it anywhere';
I18N.en.buyRated18 = '"{title}" is rated 18+ (adult content).';
I18N.en.payTitle = '💳 Pay by card';
I18N.en.payNote = 'Secure payment with Stripe. Test mode: use card 4242 4242 4242 4242.';
I18N.en.payBtn = 'Pay';
I18N.en.payCancelled = 'Payment cancelled';
I18N.en.payReceived = '✅ Payment received';
I18N.en.payConfirmErr = 'Could not confirm the payment';
I18N.en.payFinalizeErr = 'Could not confirm the payment';
I18N.en.achTitle = '🏆 My achievements';
I18N.en.achSub = 'Your level rises with every book sold.';
I18N.en.achSubName = '{name} · your creator achievements.';
I18N.en.achSubPlain = 'Your creator achievements.';
I18N.en.achStats = '{sales} sale{s} · {books} book{ps} · 💬 {notes} notes';
I18N.en.achBooksNotes = '{books} book{ps} · 💬 {notes} notes';
I18N.en.achNext = '<b>{need}</b> sale{s} away from <b>{emoji} {name}</b>';
I18N.en.achMax = '🏆 Maximum level reached!';
I18N.en.achLevelOf = ' · your level rises with every book sold.';
I18N.en.lvlCreator = 'Creator';
I18N.en.kpVerified = 'Verified creator';
I18N.en.kpVerifiedTitle = '✓';
I18N.en.kpAuthor = 'Author · {n} book{ps}';
I18N.en.kpLocation = 'Location';
I18N.en.kpWebsite = 'Website';
I18N.en.kpSince = 'Publishing since';
I18N.en.kpSiteOfficial = '🌐 Official site';
I18N.en.kpAbout = 'About';
I18N.en.kpBooks = 'Books';
I18N.en.kpReaders = 'Readers';
I18N.en.kpNotes = 'Notes';
I18N.en.kpBooksOf = 'Books by {name}';
I18N.en.kpEdit = '✏️ Edit my profile';
I18N.en.kpNoBooks = 'No published books yet.';
I18N.en.kpLoading = 'Loading profile…';
I18N.en.kpErr = 'Could not load the profile. Check your connection.';
I18N.en.kpEditTitle = 'Edit profile';
I18N.en.kpCityPh = 'City, Country';
I18N.en.kpAboutPh = 'Tell your readers who you are…';
I18N.en.kpSaving = 'Saving…';
I18N.en.kpSaved = 'Profile updated ✅';
I18N.en.kpSaveBtn = '💾 Save';
I18N.en.kpOwnerOnly = 'Only the owner can edit this profile (sign in with Google).';
I18N.en.kpPhotoHeavy = 'Photo is too heavy (max 2MB).';
I18N.en.kpPhotoType = 'Photo must be JPG, PNG, WebP or GIF';
I18N.en.kpNeedGoogle = 'Sign in with Google to edit your profile.';
I18N.en.kpPhotoAlt = 'Photo of {name}';
I18N.en.kpCoverAlt = 'Cover of {title}';
I18N.en.levelTitle = 'Creator level';
I18N.en.verifTitle = '✅ My verifications';
I18N.en.verifSub = 'Complete your verifications to build trust with your readers.';
I18N.en.vrfVerified = 'Verified';
I18N.en.vrfInReview = 'In review';
I18N.en.vrfIdTitle = '🪪 Identity';
I18N.en.vrfIdDesc = 'Confirm who you are with your full name and ID.';
I18N.en.vrfIdNamePh = 'Full name';
I18N.en.vrfIdHint = 'Every book you publish goes through an automatic anti-plagiarism check.';
I18N.en.vrfEmailTitle = '📧 Email';
I18N.en.vrfEmailDesc = 'Confirm your email with the code we show you.';
I18N.en.vrfCodePh = '6-digit code';
I18N.en.vrfPhoneTitle = '📱 Phone';
I18N.en.vrfPhoneDesc = 'Confirm your number with the code we show you.';
I18N.en.vrfBankTitle = '🏦 Bank account';
I18N.en.vrfBankDesc = 'To receive your payouts. Verified by the administrator.';
I18N.en.vrfBankRoutPh = 'Routing number';
I18N.en.vrfBankAcctPh = 'Account number';
I18N.en.vrfBankHint = 'Required for your payouts as a creator.';
I18N.en.vrfTaxTitle = '🧾 Tax info';
I18N.en.vrfTaxDesc = 'Required for your payouts as a creator.';
I18N.en.vrfTaxNamePh = 'Legal name';
I18N.en.vrfTaxAddrPh = 'Address';
I18N.en.vrfTaxSsnPh = 'SSN (last 4)';
I18N.en.vrfSendReview = 'Send for review';
I18N.en.vrfSendCode = 'Send code';
I18N.en.vrfSendVerify = 'Send for verification';
I18N.en.vrfSave = 'Save';
I18N.en.vrfChooseRating = 'Choose the rating when publishing: Everyone, 13+ or 18+.';
I18N.en.vrfIdSent = '🪪 Identity sent for review';
I18N.en.vrfNeedId = 'Complete name and ID';
I18N.en.vrfCodeSent = 'Your code (prototype): ';
I18N.en.vrfBadEmail = 'Check the email you entered';
I18N.en.vrfBadPhone = 'Check the number you entered';
I18N.en.vrfPhoneOk = '📱 Phone verified';
I18N.en.vrfBankSent = '🏦 Details sent for verification';
I18N.en.vrfTaxOk = '🧾 Tax details saved';
I18N.en.vrfNeedBank = 'Complete bank, routing and account';
I18N.en.vrfNeedFields = 'Complete all fields (SSN: 4 digits)';
I18N.en.vrfSaveErr = 'Could not save. Check your connection.';
I18N.en.admTitle = '🛡️ Review';
I18N.en.admSub = 'Pending approval.';
I18N.en.admNoAccess = 'No access.';
I18N.en.admBooks = '📚 Books in review ({n})';
I18N.en.admApprove = 'Approve';
I18N.en.admReject = 'Reject';
I18N.en.admBugs = '🐛 Bug reports';
I18N.en.admNoReports = 'No reports. 🎉';
I18N.en.admMarkRead = 'Mark read';
I18N.en.admRead = '👁️ Read';
I18N.en.admVerifyCreator = '✔️ Verified creator';
I18N.en.admCreatorNamePh = 'Creator name';
I18N.en.admNeedCreator = 'Write the creator’s name';
I18N.en.fbTitle = '🐛 Report an issue';
I18N.en.fbSub = 'Tell us what is not working and we will fix it.';
I18N.en.fbWhat = 'What is not working?';
I18N.en.fbWhatPh = 'Describe the problem…';
I18N.en.fbPage = 'Which page were you on?';
I18N.en.fbName = 'Your name (optional)';
I18N.en.fbNamePh = 'Anonymous';
I18N.en.fbSend = 'Send report';
I18N.en.fbNeedMsg = 'Describe what is not working.';
I18N.en.fbSent = '✅ Report sent. Thank you!';
I18N.en.fbErr = 'Could not send. Try again.';
I18N.en.fbOffline = 'No connection. Try again.';
I18N.en.ageTitle = '🔞 Adult content';
I18N.en.ageText = 'This book is rated 18+.';
I18N.en.ageBack = 'Back';
I18N.en.ageConfirm = 'I am an adult — continue';
I18N.en.sbTitle = '📚 Switch book';
I18N.en.sbSub = 'Choose the text everyone will read in the room.';
I18N.en.sbReading = 'Already reading this book';
I18N.en.revTitle = '⭐ Leave a review';
I18N.en.revPh = 'Your opinion (optional)…';
I18N.en.revSave = 'Post review';
I18N.en.revLoading = 'Loading reviews…';
I18N.en.revEmpty = 'No reviews yet. Be the first!';
I18N.en.revErr = 'Could not load reviews.';
I18N.en.revThanks = 'Thanks for your review! ⭐';
I18N.en.revSaveErr = 'Could not save the review — check your connection';
I18N.en.revViewTitle = 'View / leave a review';
I18N.en.noReviews = '☆ No reviews';
I18N.en.repTitle = '🚩 Report book';
I18N.en.repWhy = 'Why does it break the rules?';
I18N.en.repOtherPh = 'Describe the reason…';
I18N.en.repSend = 'Send report';
I18N.en.repR1 = 'Not the author’s original book';
I18N.en.repR2 = 'Copyrighted (it is a commercial book)';
I18N.en.repR3 = 'It is public domain';
I18N.en.repR4 = 'Content copied from another creator';
I18N.en.repROther = 'Other reason';
I18N.en.repNeedReason = 'Write the reason for the report';
I18N.en.repAlready = 'You already reported this book';
I18N.en.repSentN = 'Report sent. This book already has ';
I18N.en.repSentThanks = 'Report sent. Thanks for looking after the community.';
I18N.en.repErr = 'Could not send the report — check your connection';
I18N.en.repBadge = '⚠️ Reported by the community';
I18N.en.repBtnTitle = 'Report this book';
/* ---------- entrar a sala ---------- */
I18N.es.joinTitle = 'Entrar a la sala';
I18N.es.joinSub = 'Leemos juntos, en vivo. Elige cómo firmarás tus marcas.';
I18N.es.joinNameLbl = 'Tu nombre';
I18N.es.joinNamePh = '¿Cómo te llamas?';
I18N.es.joinInkLbl = 'Tu color de tinta';
I18N.es.joinCodeLbl = 'Código de sala';
I18N.es.joinCodePh = 'Escribe el código';
I18N.es.joinBtn = 'Entrar a la sala';
I18N.es.joinCreate = '+ Crear una sala nueva con código';
I18N.es.joinNote = 'Sin cuenta ni contraseña. Comparte el código con quien quieras que lea contigo.';
I18N.es.joinDefaultName = 'Lector';
I18N.es.joinBadCode = 'El código debe tener de 4 a 12 letras o números';
I18N.es.joinNeedCode = 'Escribe el código de la sala para entrar';
I18N.es.joinTeacherExists = '⚠️ Ya hay un profesor en esta sala';
/* ---------- sala ---------- */
I18N.es.backLibTitle = 'Volver a la biblioteca';
I18N.es.liveBadge = 'En vivo';
I18N.es.liveBadgeTitle = 'Estás dentro de una sala de lectura en vivo';
I18N.es.roomName = 'Sala';
I18N.es.copyCodeTitle = 'Copiar el código de esta sala';
I18N.es.copyCode = '⧉ copiar código';
I18N.es.pencilTitle = 'Lápiz: marcar directo con tu tinta';
I18N.es.themeTitle = 'Cambiar tema: claro / oscuro';
I18N.es.followTitle = '👀 Sígueme: la pantalla de todos sigue tu lectura';
I18N.es.handTitle = '✋ Levantar la mano';
I18N.es.switchBookTitle = '📚 Cambiar libro: todos pasan a otro texto';
I18N.es.boardModeTitle = '🖥️ Modo pizarra: solo se ve la pizarra con el párrafo actual';
I18N.es.typoTitle = 'Aa: tamaño de letra y espaciado';
I18N.es.exitTitle = '🚪 Salir de la sala';
I18N.es.pencilOn = 'Lápiz activado: marca directo con tu tinta';
I18N.es.pencilOff = 'Lápiz desactivado: solo lectura';
I18N.es.hintOn = '✏️ <b>Lápiz activado:</b> <b>toca</b> una palabra para marcarla, o desliza para marcar varias. <b>Toca tu subrayado</b> para borrar todo el párrafo. Manténlo presionado para agregarle una nota.';
I18N.es.hintOff = '✏️ <b>Lápiz desactivado:</b> solo lectura — desliza para moverte por el texto sin marcar nada. Activa el lápiz para marcar.';
I18N.es.rosterInRoom = '{n} en la sala';
I18N.es.rosterTeacher = ' · Profesor 🎓';
I18N.es.presenceHere = '👁 {names}{more} <i>lee aquí</i>';
I18N.es.presenceMore = ' y {n} más';
I18N.es.presencePara = '📖 {name} está leyendo este párrafo contigo';
I18N.es.exitedRoom = '🚪 Saliste de la sala';
I18N.es.backToRoom = '👋 De vuelta en la sala';
I18N.es.roomLinkCopied = 'Enlace de la sala copiado';
I18N.es.toolbarHl = 'Subrayar';
I18N.es.toolbarNote = 'Nota';
I18N.es.toolbarRemove = 'Quitar subrayado';
I18N.es.notePh = 'Nota corta (máx. 140 caracteres)…';
I18N.es.noteReact = 'Reacciona:';
I18N.es.noteCancel = 'Cancelar';
I18N.es.noteSave = 'Guardar nota';
I18N.es.noteSaved = 'Nota {code} guardada';
I18N.es.noteSavedPlain = 'Nota guardada al margen';
I18N.es.noteDelTitle = 'Borrar mi nota';
I18N.es.noteDelErr = 'No se pudo borrar la nota';
I18N.es.noteViewTitle = 'Ver notas de este párrafo';
I18N.es.notesEmpty = 'Aún no hay notas. Selecciona un pasaje y deja la primera.';
I18N.es.hlSaveErr = 'No se pudo guardar el subrayado — revisa tu conexión';
I18N.es.hlEraseErr = 'No se pudo borrar el subrayado — revisa tu conexión';
I18N.es.hlDelErr = 'No se pudo borrar — revisa tu conexión';
I18N.es.undoMark = '↩ Deshacer marca';
I18N.es.undoMarkN = '↩ Deshacer ({n})';
I18N.es.markUndone = 'Marca deshecha';
I18N.es.netOffline = 'Sin conexión — tus marcas se guardarán al reconectar';
I18N.es.netBack = 'Conexión recuperada ✓';
I18N.es.noteErr = 'No se pudo guardar la nota — revisa tu conexión';
I18N.es.chatEmpty = 'El chat está vacío.<br>Sé el primero en escribir. 💬';
I18N.es.chatPh = 'Escribe un mensaje…';
I18N.es.chatSendTitle = 'Enviar';
I18N.es.tabNotes = 'Notas';
I18N.es.tabChat = '💬 Chat';
I18N.es.chatErr = 'No se pudo enviar — revisa tu conexión';
I18N.es.reactErr = 'No se pudo reaccionar — revisa tu conexión';
I18N.es.handUp = '✋ Mano levantada — tócalo para bajarla';
I18N.es.handRaised = '✋ Mano levantada';
I18N.es.handLowered = 'Mano bajada';
I18N.es.handDown = '✋ Levantar la mano';
I18N.es.handErr = 'No se pudo levantar la mano — revisa tu conexión';
I18N.es.handLower = 'Tocar para bajar la mano de ';
I18N.es.netOnline = 'Conectado a la sala';
I18N.es.netOnlineTitle = 'red: en línea';
I18N.es.netOffline = 'Sin conexión — reintentando…';
I18N.es.netOfflineTitle = 'red: sin conexión, reintentando…';
I18N.es.enterErr = 'No se pudo entrar, reintentando…';
/* ---------- sígueme ---------- */
I18N.es.followPillOn = '👀 Siguiendo al profesor';
I18N.es.followPillOff = '👀 Toca para seguir al profesor';
I18N.es.followBack = '👀 Siguiendo al profesor de nuevo';
I18N.es.followLeft = 'Dejaste de seguir al profesor';
I18N.es.followActivated = '👀 Sígueme activado — todos te siguen';
I18N.es.followOnTip = '👀 Sígueme ACTIVADO — tócalo para detener el seguimiento';
I18N.es.followOffTip = '👀 Sígueme: la pantalla de todos sigue tu lectura';
I18N.es.followErr = 'No se pudo cambiar Sígueme — revisa tu conexión';
/* ---------- pizarra ---------- */
I18N.es.boardTitle = '📝 Pizarra';
I18N.es.boardClear = '🧹 Limpiar';
I18N.es.boardClearTitle = 'Limpiar la pizarra';
I18N.es.boardPh = 'Escribe algo en la pizarra con tu color… (Enter para enviar)';
I18N.es.boardSend = '✏️ Escribir';
I18N.es.boardSendTitle = 'Escribir en la pizarra';
I18N.es.boardEmpty = 'La pizarra está limpia — sé el primero en escribir. ✍️';
I18N.es.boardErr = 'No se pudo escribir en la pizarra — revisa tu conexión';
I18N.es.boardConfirm = '¿Limpiar la pizarra para todos?';
I18N.es.boardCleaned = 'Pizarra limpiada';
I18N.es.boardCleanErr = 'No se pudo limpiar la pizarra';
I18N.es.boardCount = '✏️ {n} mensaje{ps} en la pizarra';
I18N.es.boardModeTitle = '📝 Pizarra de clase';
I18N.es.boardModeExit = '✖ Salir';
I18N.es.boardModeExitTitle = 'Salir del modo pizarra';
/* ---------- párrafo ---------- */
I18N.es.paraOf = 'Párrafo {i} de {n}';
I18N.es.paraDash = 'Párrafo —';
I18N.es.paraCleaned = 'Párrafo limpiado';
I18N.es.otherBook = 'otro libro';
I18N.es.paraPrevTitle = 'Párrafo anterior';
I18N.es.paraNextTitle = 'Párrafo siguiente';
I18N.es.prevPage = '← Anterior';
I18N.es.nextPage = 'Siguiente →';
I18N.es.paraErr = 'No se pudo cambiar el párrafo — revisa tu conexión';
I18N.es.paraTeacherMoved = '📖 El profesor pasó al ';
I18N.es.paraTeacherBook = '📚 El profesor cambió a "';
/* ---------- tarjetas / biblioteca ---------- */
I18N.es.tileFree = 'Gratis';
I18N.es.tileOwned = 'Adquirido';
I18N.es.tileRead = 'Leer';
I18N.es.tileView = 'Ver';
I18N.es.tileReadNow = 'Leer ahora';
I18N.es.tileViewBook = 'Ver libro';
I18N.es.tileContinue = '📖 Continuar';
I18N.es.tileFeatureTitle = 'Destacar en portada';
I18N.es.tileDestBadge = '⭐ DESTACADO';
I18N.es.tileClassic = ' 📜 <span class="rtype">Clásico gratis</span>';
I18N.es.tileCreatorBook = ' 📝 <span class="rtype">Libro de creador</span>';
I18N.es.tileSample = ' 📄 <span class="rtype">Texto de muestra</span>';
I18N.es.classicInfo = '📜 Clásico de dominio público — gratis para todos. Tus marcas son visibles para todos los lectores.';
I18N.es.classicBadge = '📜 Dominio público';
I18N.es.reviewBadge = '⏳ En revisión';
I18N.es.bookBoughtInfo = 'Libro adquirido. Tus marcas son visibles para todos los lectores.';
I18N.es.bookFreeInfo = 'Libro gratuito. Tus marcas son visibles para todos los lectores.';
I18N.es.noResults = 'Sin resultados para tu búsqueda. Prueba con otro título.';
I18N.es.publishFirst = 'Aún no hay libros aquí — ¡publica el primero con ＋ Publicar libro!';
I18N.es.noBooksYet = 'No hay libros en la biblioteca todavía.';
I18N.es.libErr = 'No se pudo cargar la biblioteca. Revisa tu conexión.';
I18N.es.loadErr = 'No se pudo cargar. Revisa tu conexión.';
I18N.es.openBookErr = 'No se pudo abrir el libro — revisa tu conexión e intenta de nuevo';
I18N.es.communityMarks = 'La comunidad ya dejó {marks} marcas y {notes} notas en este libro.';
I18N.es.communityFirst = 'Sé de los primeros en leerlo y marcarlo con tu tinta.';
I18N.es.sampleCta = '📖 Continuar';
I18N.es.csTitle = '📊 Tu libro';
I18N.es.csOffline = 'Sin conexión';
I18N.es.csLoading = 'Cargando…';
I18N.es.csMarks = 'marcas';
I18N.es.csNotes = 'notas';
I18N.es.creatorVerified = '✔️';
I18N.es.creatorVerifiedTitle = 'Creador verificado';
I18N.es.blackInk = 'Negro — reservado para el profesor 🎓';
I18N.es.teacherMode = '🎓 Modo profesor: tinta negra';
I18N.es.studentMode = 'Modo estudiante';
/* ---------- hero ---------- */
I18N.es.heroCtaRead = 'Leer ahora';
I18N.es.heroCtaView = 'Ver libro';
/* ---------- inmersiva ---------- */
I18N.es.immClose = 'Cerrar';
I18N.es.immCtaDefault = 'Ver';
/* ---------- tipografía ---------- */
I18N.es.typoTitle = 'Aa &nbsp;Tu lectura, a tu medida';
I18N.es.typoSize = 'Tamaño de letra';
I18N.es.typoSpacing = 'Espaciado';
I18N.es.typoCompact = 'Compacto';
I18N.es.typoNormal = 'Normal';
I18N.es.typoWide = 'Amplio';
I18N.es.typoWidth = 'Ancho del texto';
I18N.es.typoNarrow = 'Estrecho';
I18N.es.typoWideW = 'Ancho';
I18N.es.typoDone = 'Listo';
/* ---------- auth ---------- */
I18N.es.googleLogin = '🔐 Entrar con Google';
I18N.es.googleUnavailable = '🔐 El login con Google no está disponible en este servidor';
I18N.es.googleNeed = '🔐 Esta acción necesita login con Google (no disponible en este servidor)';
I18N.es.googleOk = '✅ Sesión iniciada con Google';
I18N.es.googleErr = '❌ Error al entrar con Google';
I18N.es.logoutOf = '¿Cerrar sesión de ';
I18N.es.myAccount = 'Mi cuenta';
I18N.es.sessionStarted = '✅ Sesión iniciada';
I18N.es.sessionErr = '⚠️ No se pudo iniciar sesión';
/* ---------- tema ---------- */
I18N.es.themeLight = 'Tema claro';
I18N.es.themeDark = 'Tema oscuro cálido';
/* ---------- tiempos ---------- */
I18N.es.relNow = 'ahora mismo';
I18N.es.relSecs = 'hace {n} segundo{ps}';
I18N.es.relMins = 'hace {n} minuto{ps}';
I18N.es.relHours = 'hace {n} hora{ps}';
I18N.es.relDays = 'hace {n} día{ps}';
/* ---------- varios ---------- */
I18N.es.anonymous = 'Anónimo';
I18N.es.loading = 'Cargando…';
I18N.es.connErr = '— revisa tu conexión';
I18N.es.offlineRetry = 'Sin conexión. Intenta de nuevo.';
I18N.es.closeBtn = 'Cerrar';
I18N.es.professorWord = 'Profesor';
I18N.en.joinTitle = 'Enter the room';
I18N.en.joinSub = 'We read together, live. Choose how you will sign your marks.';
I18N.en.joinNameLbl = 'Your name';
I18N.en.joinNamePh = 'What is your name?';
I18N.en.joinInkLbl = 'Your ink color';
I18N.en.joinCodeLbl = 'Room code';
I18N.en.joinCodePh = 'Type the code';
I18N.en.joinBtn = 'Enter the room';
I18N.en.joinCreate = '+ Create a new room with a code';
I18N.en.joinNote = 'No account or password. Share the code with whoever you want to read with.';
I18N.en.joinDefaultName = 'Reader';
I18N.en.joinBadCode = 'Code must be 4 to 12 letters or numbers';
I18N.en.joinNeedCode = 'Type the room code to join';
I18N.en.joinTeacherExists = '⚠️ There is already a teacher in this room';
I18N.en.backLibTitle = 'Back to the library';
I18N.en.liveBadge = 'Live';
I18N.en.liveBadgeTitle = 'You are inside a live reading room';
I18N.en.roomName = 'Room';
I18N.en.copyCodeTitle = 'Copy this room’s code';
I18N.en.copyCode = '⧉ copy code';
I18N.en.pencilTitle = 'Pencil: mark directly with your ink';
I18N.en.themeTitle = 'Switch theme: light / dark';
I18N.en.followTitle = '👀 Follow me: everyone’s screen follows your reading';
I18N.en.handTitle = '✋ Raise your hand';
I18N.en.switchBookTitle = '📚 Switch book: everyone moves to another text';
I18N.en.boardModeTitle = '🖥️ Board mode: only the board with the current paragraph is shown';
I18N.en.typoTitle = 'Aa: font size and spacing';
I18N.en.exitTitle = '🚪 Leave the room';
I18N.en.pencilOn = 'Pencil on: mark directly with your ink';
I18N.en.pencilOff = 'Pencil off: read-only';
I18N.en.hintOn = '✏️ <b>Pencil on:</b> <b>tap</b> a word to mark it, or swipe to mark several. <b>Tap your highlight</b> to clear the whole paragraph. Long-press to add a note.';
I18N.en.hintOff = '✏️ <b>Pencil off:</b> read-only — swipe to move through the text without marking. Turn the pencil on to mark.';
I18N.en.rosterInRoom = '{n} in the room';
I18N.en.rosterTeacher = ' · Teacher 🎓';
I18N.en.presenceHere = '👁 {names}{more} <i>is reading here</i>';
I18N.en.presenceMore = ' and {n} more';
I18N.en.presencePara = '📖 {name} is reading this paragraph with you';
I18N.en.exitedRoom = '🚪 You left the room';
I18N.en.backToRoom = '👋 Back in the room';
I18N.en.roomLinkCopied = 'Room link copied';
I18N.en.toolbarHl = 'Highlight';
I18N.en.toolbarNote = 'Note';
I18N.en.toolbarRemove = 'Remove highlight';
I18N.en.notePh = 'Short note (max 140 characters)…';
I18N.en.noteReact = 'React:';
I18N.en.noteCancel = 'Cancel';
I18N.en.noteSave = 'Save note';
I18N.en.noteSaved = 'Note {code} saved';
I18N.en.noteSavedPlain = 'Note saved in the margin';
I18N.en.noteDelTitle = 'Delete my note';
I18N.en.noteDelErr = 'Could not delete the note';
I18N.en.noteViewTitle = 'View notes on this paragraph';
I18N.en.notesEmpty = 'No notes yet. Select a passage and leave the first one.';
I18N.en.hlSaveErr = 'Could not save the highlight — check your connection';
I18N.en.hlEraseErr = 'Could not erase the highlight — check your connection';
I18N.en.hlDelErr = 'Could not delete — check your connection';
I18N.en.undoMark = '↩ Undo mark';
I18N.en.undoMarkN = '↩ Undo ({n})';
I18N.en.markUndone = 'Highlight undone';
I18N.en.netOffline = 'Offline — your marks will sync when you reconnect';
I18N.en.netBack = 'Connection restored ✓';
I18N.en.noteErr = 'Could not save the note — check your connection';
I18N.en.chatEmpty = 'Chat is empty.<br>Be the first to write. 💬';
I18N.en.chatPh = 'Write a message…';
I18N.en.chatSendTitle = 'Send';
I18N.en.tabNotes = 'Notes';
I18N.en.tabChat = '💬 Chat';
I18N.en.chatErr = 'Could not send — check your connection';
I18N.en.reactErr = 'Could not react — check your connection';
I18N.en.handUp = '✋ Hand raised — tap to lower it';
I18N.en.handRaised = '✋ Hand raised';
I18N.en.handLowered = 'Hand lowered';
I18N.en.handDown = '✋ Raise your hand';
I18N.en.handErr = 'Could not raise your hand — check your connection';
I18N.en.handLower = 'Tap to lower the hand of ';
I18N.en.netOnline = 'Connected to the room';
I18N.en.netOnlineTitle = 'net: online';
I18N.en.netOffline = 'No connection — retrying…';
I18N.en.netOfflineTitle = 'net: offline, retrying…';
I18N.en.enterErr = 'Could not join, retrying…';
I18N.en.followPillOn = '👀 Following the teacher';
I18N.en.followPillOff = '👀 Tap to follow the teacher';
I18N.en.followBack = '👀 Following the teacher again';
I18N.en.followLeft = 'You stopped following the teacher';
I18N.en.followActivated = '👀 Follow-me on — everyone follows you';
I18N.en.followOnTip = '👀 FOLLOW-ME ON — tap to stop following';
I18N.en.followOffTip = '👀 Follow me: everyone’s screen follows your reading';
I18N.en.followErr = 'Could not change Follow-me — check your connection';
I18N.en.boardTitle = '📝 Board';
I18N.en.boardClear = '🧹 Clear';
I18N.en.boardClearTitle = 'Clear the board';
I18N.en.boardPh = 'Write something on the board in your color… (Enter to send)';
I18N.en.boardSend = '✏️ Write';
I18N.en.boardSendTitle = 'Write on the board';
I18N.en.boardEmpty = 'The board is clean — be the first to write. ✍️';
I18N.en.boardErr = 'Could not write on the board — check your connection';
I18N.en.boardConfirm = 'Clear the board for everyone?';
I18N.en.boardCleaned = 'Board cleared';
I18N.en.boardCleanErr = 'Could not clear the board';
I18N.en.boardCount = '✏️ {n} message{ps} on the board';
I18N.en.boardModeTitle = '📝 Class board';
I18N.en.boardModeExit = '✖ Exit';
I18N.en.boardModeExitTitle = 'Exit board mode';
I18N.en.paraOf = 'Paragraph {i} of {n}';
I18N.en.paraDash = 'Paragraph —';
I18N.en.paraCleaned = 'Paragraph cleared';
I18N.en.otherBook = 'another book';
I18N.en.paraPrevTitle = 'Previous paragraph';
I18N.en.paraNextTitle = 'Next paragraph';
I18N.en.prevPage = '← Previous';
I18N.en.nextPage = 'Next →';
I18N.en.paraErr = 'Could not change the paragraph — check your connection';
I18N.en.paraTeacherMoved = '📖 The teacher moved to ';
I18N.en.paraTeacherBook = '📚 The teacher switched to "';
I18N.en.tileFree = 'Free';
I18N.en.tileOwned = 'Owned';
I18N.en.tileRead = 'Read';
I18N.en.tileView = 'View';
I18N.en.tileReadNow = 'Read now';
I18N.en.tileViewBook = 'View book';
I18N.en.tileContinue = '📖 Continue';
I18N.en.tileFeatureTitle = 'Feature on the front page';
I18N.en.tileDestBadge = '⭐ FEATURED';
I18N.en.tileClassic = ' 📜 <span class="rtype">Free classic</span>';
I18N.en.tileCreatorBook = ' 📝 <span class="rtype">Creator book</span>';
I18N.en.tileSample = ' 📄 <span class="rtype">Sample text</span>';
I18N.en.classicInfo = '📜 Public-domain classic — free for everyone. Your marks are visible to all readers.';
I18N.en.classicBadge = '📜 Public domain';
I18N.en.originalBadge = '✍️ Original';
I18N.en.reviewBadge = '⏳ In review';
I18N.en.bookBoughtInfo = 'Book purchased. Your marks are visible to all readers.';
I18N.en.bookFreeInfo = 'Free book. Your marks are visible to all readers.';
I18N.en.noResults = 'No results for your search. Try another title.';
I18N.en.publishFirst = 'No books here yet — publish the first one with ＋ Publish book!';
I18N.en.noBooksYet = 'No books in the library yet.';
I18N.en.libErr = 'Could not load the library. Check your connection.';
I18N.en.loadErr = 'Could not load. Check your connection.';
I18N.en.openBookErr = 'Could not open the book — check your connection and try again';
I18N.en.communityMarks = 'The community has left {marks} marks and {notes} notes on this book.';
I18N.en.communityFirst = 'Be among the first to read it and mark it with your ink.';
I18N.en.sampleCta = '📖 Continue';
I18N.en.csTitle = '📊 Your book';
I18N.en.csOffline = 'Offline';
I18N.en.csLoading = 'Loading…';
I18N.en.csMarks = 'marks';
I18N.en.csNotes = 'notes';
I18N.en.creatorVerified = '✔️';
I18N.en.creatorVerifiedTitle = 'Verified creator';
I18N.en.blackInk = 'Black — reserved for the teacher 🎓';
I18N.en.teacherMode = '🎓 Teacher mode: black ink';
I18N.en.studentMode = 'Student mode';
I18N.en.heroCtaRead = 'Read now';
I18N.en.heroCtaView = 'View book';
I18N.en.immClose = 'Close';
I18N.en.immCtaDefault = 'View';
I18N.en.typoTitle = 'Aa &nbsp;Your reading, your way';
I18N.en.typoSize = 'Font size';
I18N.en.typoSpacing = 'Spacing';
I18N.en.typoCompact = 'Compact';
I18N.en.typoNormal = 'Normal';
I18N.en.typoWide = 'Wide';
I18N.en.typoWidth = 'Text width';
I18N.en.typoNarrow = 'Narrow';
I18N.en.typoWideW = 'Wide';
I18N.en.typoDone = 'Done';
I18N.en.googleLogin = '🔐 Sign in with Google';
I18N.en.googleUnavailable = '🔐 Google sign-in is not available on this server';
I18N.en.googleNeed = '🔐 This action needs Google sign-in (not available on this server)';
I18N.en.googleOk = '✅ Signed in with Google';
I18N.en.googleErr = '❌ Google sign-in error';
I18N.en.logoutOf = 'Log out of ';
I18N.en.myAccount = 'My account';
I18N.en.sessionStarted = '✅ Signed in';
I18N.en.sessionErr = '⚠️ Could not sign in';
I18N.en.themeLight = 'Light theme';
I18N.en.themeDark = 'Warm dark theme';
I18N.en.relNow = 'just now';
I18N.en.relSecs = '{n} second{ps} ago';
I18N.en.relMins = '{n} minute{ps} ago';
I18N.en.relHours = '{n} hour{ps} ago';
I18N.en.relDays = '{n} day{ps} ago';
I18N.en.anonymous = 'Anonymous';
I18N.en.loading = 'Loading…';
I18N.en.connErr = '— check your connection';
I18N.en.offlineRetry = 'No connection. Try again.';
I18N.en.closeBtn = 'Close';
I18N.en.professorWord = 'Teacher';


I18N.es.backToReading = '📖 De vuelta en tu lectura';
I18N.es.roomLinkManual = 'Enlace de la sala: ';
I18N.es.admToggleBadge = 'Otorgar / quitar insignia';
I18N.es.kpEditFor = 'Editar perfil — ';
I18N.es.kpPhotoLbl = 'Foto de perfil';
I18N.es.kpBioLbl = 'Bio corta (160)';
I18N.es.kpBioPh = 'Una línea sobre ti';
I18N.es.kpLocLbl = 'Ubicación';
I18N.es.kpWebLbl = 'Sitio web';
I18N.es.kpSocLbl = 'Redes oficiales';
I18N.es.kpAboutLbl = 'Acerca de (1000)';
I18N.es.immTagAd = 'ANUNCIO';
I18N.es.immTagCommunity = 'COMUNIDAD';
I18N.es.viewLibrary = 'Biblioteca';
I18N.es.viewRoom = 'Sala en vivo';
I18N.es.viewJoin = 'Entrar a sala';
I18N.es.viewWriting = 'Escribir';
I18N.es.viewImmersive = 'Vista inmersiva';
I18N.es.colorNames = { azul:'Azul', rojo:'Rojo', verde:'Verde', ambar:'Ámbar', violeta:'Violeta', negro:'Negro', celeste:'Celeste', turquesa:'Turquesa', cian:'Cian', indigo:'Índigo', lila:'Lila', fucsia:'Fucsia', magenta:'Magenta', rosa:'Rosa', coral:'Coral', naranja:'Naranja', salmon:'Salmón', terracota:'Terracota', mostaza:'Mostaza', dorado:'Dorado', lima:'Lima', esmeralda:'Esmeralda', menta:'Menta', oliva:'Oliva', chocolate:'Chocolate', vino:'Vino', petroleo:'Petróleo', gris:'Gris' };


I18N.en.backToReading = '📖 Back to your reading';
I18N.en.roomLinkManual = 'Room link: ';
I18N.en.admToggleBadge = 'Grant / remove badge';
I18N.en.kpEditFor = 'Edit profile — ';
I18N.en.kpPhotoLbl = 'Profile photo';
I18N.en.kpBioLbl = 'Short bio (160)';
I18N.en.kpBioPh = 'One line about you';
I18N.en.kpLocLbl = 'Location';
I18N.en.kpWebLbl = 'Website';
I18N.en.kpSocLbl = 'Official socials';
I18N.en.kpAboutLbl = 'About (1000)';
I18N.en.immTagAd = 'AD';
I18N.en.immTagCommunity = 'COMMUNITY';
I18N.en.viewLibrary = 'Library';
I18N.en.viewRoom = 'Live room';
I18N.en.viewJoin = 'Enter room';
I18N.en.viewWriting = 'Write';
I18N.en.viewImmersive = 'Immersive view';
I18N.en.colorNames = { azul:'Blue', rojo:'Red', verde:'Green', ambar:'Amber', violeta:'Violet', negro:'Black', celeste:'Sky blue', turquesa:'Turquoise', cian:'Cyan', indigo:'Indigo', lila:'Lilac', fucsia:'Fuchsia', magenta:'Magenta', rosa:'Pink', coral:'Coral', naranja:'Orange', salmon:'Salmon', terracota:'Terracotta', mostaza:'Mustard', dorado:'Golden', lima:'Lime', esmeralda:'Emerald', menta:'Mint', oliva:'Olive', chocolate:'Chocolate', vino:'Wine', petroleo:'Petrol', gris:'Gray' };


I18N.es.vrfRowVerified = 'Creador verificado';
I18N.es.vrfRowVerifiedDesc = 'La insignia azul junto a tu nombre genera confianza.';
I18N.es.vrfGrantedByAdmin = '⚪ La otorga el administrador';
I18N.es.vrfRowOriginality = 'Originalidad';
I18N.es.vrfActive = 'Activa';
I18N.es.vrfRowIdentity = 'Identidad';
I18N.es.vrfDocPh = 'Documento de identidad';
I18N.es.vrfRowAge = 'Clasificación de edad';
I18N.es.vrfRowPreReview = 'Revisión previa';
I18N.es.vrfRowPreReviewDesc = 'Tus libros salen en la biblioteca tras la aprobación del administrador.';
I18N.es.vrfRowEmail = 'Email verificado';
I18N.es.vrfRowPhone = 'Teléfono verificado';
I18N.es.vrfRowBank = 'Cuenta bancaria';
I18N.es.vrfBankNamePh = 'Banco';
I18N.es.vrfRowTax = 'Datos fiscales';
I18N.es.vrfTaxDone = 'Datos registrados';
I18N.es.vrfVerifyBtn = 'Verificar';
I18N.es.vrfRejected = '❌ Rechazado';
I18N.es.vrfPending = '⚪ Pendiente';
I18N.es.vrfEmailOk = '📧 Email verificado';
I18N.es.vrfBadCode = 'Código incorrecto';


I18N.en.vrfRowVerified = 'Verified creator';
I18N.en.vrfRowVerifiedDesc = 'The blue badge next to your name builds trust.';
I18N.en.vrfGrantedByAdmin = '⚪ Granted by the administrator';
I18N.en.vrfRowOriginality = 'Originality';
I18N.en.vrfActive = 'Active';
I18N.en.vrfRowIdentity = 'Identity';
I18N.en.vrfDocPh = 'ID document';
I18N.en.vrfRowAge = 'Age rating';
I18N.en.vrfRowPreReview = 'Pre-review';
I18N.en.vrfRowPreReviewDesc = 'Your books appear in the library after the administrator approves them.';
I18N.en.vrfRowEmail = 'Verified email';
I18N.en.vrfRowPhone = 'Verified phone';
I18N.en.vrfRowBank = 'Bank account';
I18N.en.vrfBankNamePh = 'Bank';
I18N.en.vrfRowTax = 'Tax info';
I18N.en.vrfTaxDone = 'Details on file';
I18N.en.vrfVerifyBtn = 'Verify';
I18N.en.vrfRejected = '❌ Rejected';
I18N.en.vrfPending = '⚪ Pending';
I18N.en.vrfEmailOk = '📧 Email verified';
I18N.en.vrfBadCode = 'Wrong code';


I18N.es.ageAll = 'Todos';
I18N.es.admNothing = 'Nada pendiente.';
I18N.es.admIdentities = '🪪 Identidades ({n})';
I18N.es.admBanks = '🏦 Cuentas bancarias ({n})';
I18N.es.admDone = 'Hecho';
I18N.es.admFail = 'No se pudo';
I18N.es.admVerified = '✔️ {name} verificado';


I18N.en.ageAll = 'All';
I18N.en.admNothing = 'Nothing pending.';
I18N.en.admIdentities = '🪪 Identities ({n})';
I18N.en.admBanks = '🏦 Bank accounts ({n})';
I18N.en.admDone = 'Done';
I18N.en.admFail = 'Failed';
I18N.en.admVerified = '✔️ {name} verified';


I18N.es.noBooksYet = 'No hay libros en la biblioteca todavía.';
I18N.es.adFeatSub = 'Lo más famoso y más vendido para tu momento de lectura.';
I18N.es.adBuyNow = 'Comprar';
I18N.es.libBookWord = 'Libro';
I18N.es.levelTitle = 'Nivel de creador';
I18N.es.creatorVerifiedTitle = 'Creador verificado';
I18N.es.classicBadge = '📜 Dominio público';
I18N.es.originalBadge = '✍️ Original';
I18N.es.reviewBadge = '⏳ En revisión';
I18N.es.libViewRecord = 'Ver ficha';
I18N.es.libReadBtn = 'Leer';
I18N.es.csLoading = 'Cargando…';
I18N.es.csOffline = 'Sin conexión';
I18N.es.csMarks = 'marcas';
I18N.es.csNotes = 'notas';
I18N.es.palInkBlue = 'Azul tinta';
I18N.es.palCharcoal = 'Carbón';
I18N.es.palGold = 'Dorado';
I18N.es.palForest = 'Bosque';
I18N.es.palEarth = 'Tierra';
I18N.es.palSlate = 'Pizarra';


I18N.en.noBooksYet = 'No books in the library yet.';
I18N.en.adFeatSub = 'The most famous and bestselling picks for your reading time.';
I18N.en.adBuyNow = 'Buy';
I18N.en.libBookWord = 'Book';
I18N.en.levelTitle = 'Creator level';
I18N.en.creatorVerifiedTitle = 'Verified creator';
I18N.en.classicBadge = '📜 Public domain';
I18N.en.originalBadge = '✍️ Original';
I18N.en.reviewBadge = '⏳ Under review';
I18N.en.libViewRecord = 'View details';
I18N.en.libReadBtn = 'Read';
I18N.en.csLoading = 'Loading…';
I18N.en.csOffline = 'Offline';
I18N.en.csMarks = 'marks';
I18N.en.csNotes = 'notes';
I18N.en.palInkBlue = 'Ink blue';
I18N.en.palCharcoal = 'Charcoal';
I18N.en.palGold = 'Gold';
I18N.en.palForest = 'Forest';
I18N.en.palEarth = 'Earth';
I18N.en.palSlate = 'Slate';


I18N.es.contCta = 'Seguir leyendo →';
I18N.es.buyLoadErr = 'No se pudo abrir el libro — revisa tu conexión e intenta de nuevo';
I18N.es.themeLabel = ' Tema';


I18N.en.contCta = 'Keep reading →';
I18N.en.buyLoadErr = "Couldn't open the book — check your connection and try again";
I18N.en.themeLabel = ' Theme';

/* ================= motor i18n ================= */
let UI_LANG = 'es';
try {
  const saved = localStorage.getItem('tj_ui_lang');
  if (saved === 'es' || saved === 'en') UI_LANG = saved;
  else if ((navigator.language || '').toLowerCase().startsWith('en')) UI_LANG = 'en';
} catch (e) {}
/* t('clave', {var: x}) — interpolación {var}; fallback a español, luego a la clave */
function t(key, vars) {
  const pack = I18N[UI_LANG] || {};
  let s = (key in pack) ? pack[key] : (I18N.es[key] !== undefined ? I18N.es[key] : key);
  if (vars && typeof s === 'string') {
    for (const k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
  }
  return s;
}
/* ¿Existe la clave en algún diccionario? (evita pintar la clave cruda si el JS va desfasado del HTML) */
function hasKey(key) {
  const pack = I18N[UI_LANG] || {};
  return (key in pack) || (I18N.es[key] !== undefined);
}
/* Aplica data-i18n* a todo el DOM estático */
function applyStaticI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { const k = el.dataset.i18n; if (hasKey(k)) el.textContent = t(k); });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { const k = el.dataset.i18nHtml; if (hasKey(k)) el.innerHTML = t(k); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { const k = el.dataset.i18nPh; if (hasKey(k)) el.placeholder = t(k); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { const k = el.dataset.i18nTitle; if (hasKey(k)) el.title = t(k); });
  if (hasKey('docTitle')) document.title = t('docTitle');
  try { document.documentElement.lang = UI_LANG; } catch (e) {}
  updateLangUI();
}
/* Botón 🌐 del header + entrada del drawer muestran el idioma DESTINO */
function updateLangUI() {
  const target = UI_LANG === 'es' ? 'en' : 'es';
  const lbl = UI_LANG === 'es' ? 'EN' : 'ES';
  const lb = document.getElementById('langBtnLbl');
  if (lb) lb.textContent = lbl;
  const lbt = document.getElementById('langBtn');
  if (lbt) lbt.title = t('langBtnTitle');
  const dw = document.getElementById('langDrawerBtn');
  if (dw) dw.textContent = UI_LANG === 'es' ? '🌐 English' : '🌐 Español';
}
/* Cambia el idioma en vivo (sin recargar) */
function setLang(lang) {
  if (lang !== 'es' && lang !== 'en') return;
  if (lang === UI_LANG) return;
  UI_LANG = lang;
  try { localStorage.setItem('tj_ui_lang', lang); } catch (e) {}
  applyStaticI18n();
  try { window.dispatchEvent(new CustomEvent('uilang', { detail: { lang } })); } catch (e) {}
}
function toggleLang() { setLang(UI_LANG === 'es' ? 'en' : 'es'); }
/* Nombre de color localizado (las claves son identificadores) */
function colorName(k) { const m = (I18N[UI_LANG] && I18N[UI_LANG].colorNames) || {}; return m[k] || (I18N.es.colorNames || {})[k] || k; }
/* Etiquetas de vista para el formulario de feedback */
function viewLabel(v) { return t({ library:'viewLibrary', room:'viewRoom', join:'viewJoin', writing:'viewWriting', immersive:'viewImmersive' }[v] || 'viewLibrary'); }
/* Cablea el selector (lo llama app.js en su init) */
function initLangUI() {
  const b = document.getElementById('langBtn');
  if (b && !b.dataset.bound) { b.dataset.bound = '1'; b.onclick = toggleLang; }
  updateLangUI();
}
applyStaticI18n();
