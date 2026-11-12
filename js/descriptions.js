// descriptions.js — one-line Hungarian descriptions per canonical analyte.
// Collected from Wikipedia (hu/en) summaries, manually compressed.
// Static text, shipped with the app — no runtime network requests.

export const DESCRIPTIONS = {
  hemoglobin:
    "Vastartalmú fehérje a vörösvértestekben; ez szállítja az oxigént a tüdőből a szövetekhez.",
  erythrocytes:
    "A leggyakoribb vérsejt; fő feladata az oxigén szállítása a test szöveteihez.",
  hematocrit:
    "A vér sejtes komponenseinek (főleg vörösvértesteknek) térfogataránya a teljes vérhez képest.",
  mcv: "Az átlagos vörösvértest-térfogat; a vérszegénység típusának elkülönítésében segít.",
  mch: "Az átlagos hemoglobintömeg egyetlen vörösvértestben.",
  mchc: "A hemoglobin koncentrációja a vörösvértestek tömegére vetítve.",
  rdw: "A vörösvértestek térfogatának szórása; vashiányos vérszegénységben nő.",
  mpv: "Az átlagos vérlemezke-méret; a csontvelő vérlemezke-termelésére utal.",
  leukocytes:
    "Az immunrendszer sejtjei; a fertőzések és idegen anyagok ellen védenek. Számuk gyakran jelzi a betegségeket.",
  thrombocytes:
    "Vérlemezkék: sejtmag nélküli sejtfragmensek, amelyek sérülésnél összekupacozva vérrögöt képeznek.",
  "neutrophil-abs":
    "A leggyakoribb fehérvérsejt (a leukociták 40–75%-a); a veleszületett immunitás első vonala, főleg baktériumok ellen. Gyulladásnál az elsők között jelenik meg a gyulladás helyszínén.",
  "neutrophil-pct":
    "A neutrofil granulociták aránya a fehérvérsejtekön belül; a leggyakoribb fehérvérsejt, a baktériumfertőzések elleni védelem első vonala.",
  "lymphocyte-abs":
    "A fehérvérsejtek B-, T- és NK-sejt típusai; az adaptív immunválasz fő effector és effektor sejtjei.",
  "lymphocyte-pct":
    "A limfociták aránya a fehérvérsejtekön belül; az adaptív immunválasz (B-, T-, NK-sejtek) sejtjei.",
  "monocyte-abs":
    "Méretre a legnagyobb fehérvérsejt; makrofágokká vagy dendritikus sejtekké differenciálódva bekebelezik a kórokozókat.",
  "monocyte-pct":
    "A monociták aránya a fehérvérsejtekön belül; makrofággá és dendritikus sejtté differenciálódó falósejtek.",
  "eosinophil-abs":
    "Főleg a paraziták elleni védekezésért felelnek; allergiás és asztmás folyamatokban is szerepet játszanak.",
  "eosinophil-pct":
    "Az eozinofilek aránya a fehérvérsejtekön belül; paraziták ellen és allergiás reakciókban fontosak.",
  "basophil-abs":
    "A legritkább fehérvérsejt (0,5–1%); hisztamint és szerotonint termel, allergiás és gyulladásos reakciókban játszik szerepet.",
  "basophil-pct":
    "A bazofilek aránya a fehérvérsejtekön belül; hisztamintermelésükkel allergiás és gyulladásos reakciókat indítanak.",
  sodium:
    "Kulcsfontosságú elektrolit; a vízháztartás, az ideg- és izomműködés szabályozásában nélkülözhetetlen.",
  potassium:
    "Elektrolit; az idegi ingerületátvitelben, az izom- és szívritmus működésében alapvető.",
  calcium:
    "A csontok fő építőanyaga; izomösszehúzódásban, véralvadásban és sejti jelátvitelben is kulcsszerepű.",
  magnesium:
    "Körülbelül 300 enzim alkotóeleme; izom- és idegműködéshez, energiametabolizmushoz nélkülözhetetlen.",
  asat:
    "Enzim, amely főleg a májban, szívben és vázizomzatban található; szérum szintje máj- és izomkárosodás markere.",
  alat:
    "Enzim, amely a legnagyobb mennyiségben a májban fordul elő; a máj egészségének rutin vérvizsgálati markere.",
  ggt:
    "Főleg a májban található enzim; epeúti betegségek és májkárosodás diagnosztikai markere.",
  alp:
    "Enzim, amely a májban, csontban, bélben fordul elő; vér szintje máj- és csontbetegségek felmérésében segít.",
  ldh:
    "Minden szövetben jelen lévő enzim; szövetkárosodáskor szabadul fel, így szív- és egyéb sérülések markere.",
  amylase:
    "A keményítőt cukrokká bontó enzim; a nyálban és a hasnyálmirigy váladékában termelődik. Vér szintje hasnyálmirigy-gyulladásnál emelkedik.",
  ck:
    "Enzim, amely az izmok gyors ATP-utánpótlását biztosítja; vérből mért szintje izom- és szívkárosodás markere.",
  cholesterol:
    "Minden állati sejt membránjának építőanyaga, szteroidhormonok és epesavak előanyaga. Magas vér szintje az érelmeszesedés kockázati tényezője.",
  hdl:
    "A „jó koleszterin”: a felesleges koleszterint a szövetekből az erek falából a májba visszaszállító lipoprotein.",
  ldl:
    "A „rossz koleszterin”: koleszterint szállít a májból a szövetek felé; tartósan magas szintje érelmeszesedést, szív- és érrendszeri betegségeket okoz.",
  triglycerides:
    "A vérben szállított zsírok fő formája; a sejtek energiaforrása és a zsírraktárak építőköve.",
  creatinine:
    "Az izomanyagcsere állandó ütemben keletkező végterméke; szérum szintje a vesefunkció leggyakoribb mutatója.",
  egfr:
    "A vesék szűrőképességének (glomeruláris filtrációs sebesség) kreatininből számított becslése.",
  urea:
    "A fehérjeanyagcsere végterméke, amelyet a vesék választanak ki; vérszintje a vesefunkció további mutatója.",
  "uric-acid":
    "A purinanyagcsere végterméke, amely a vizelettel ürül; magas szintje köszvényhez vezethet.",
  "bilirubin-total":
    "Epefesték, a hemoglobin hem részének sárga bomlásterméke; magas szintje sárgaságot okoz.",
  "bilirubin-direct":
    "A konjugált (a máj által vízben oldhatóvá tett) epefesték; emelkedése gyakran epeelfolyási zavarra utal.",
  glucose:
    "A vércukor: a sejtek fő energiaforrása; tartós magas szintje cukorbetegséget jelez.",
  crp:
    "A máj által termelt gyulladásos fehérje; vér szintje gyulladásra, fertőzésre gyorsan emelkedik.",
  albumin:
    "A leggyakoribb vérszérum-fehérje, amelyet a máj termel; a plazma onkotikus nyomását és a szállítási feladatokat látja el.",
  "total-protein":
    "A vérplazmában lévő fehérjék (albumin, immunglobulinok stb.) együttes mennyisége.",
  iron:
    "Nyomelem, a hemoglobin alkotórésze; hiánya vashiányos vérszegénységet okoz.",
  tibc:
    "A szérum transzferrinjének összes vasmegkötő kapacitása; vashiánynál nő, vasterülésnél csökken.",
  transferrin:
    "A májban termelt glikoprotein, amely két Fe³⁺-iont megkötve szállítja a vasat a vérplazmában.",
  tfsat:
    "A szérumvas és a teljes vaskötő kapacitás hányadosa %-ban; megmutatja, a transzferrin mekkora része van telítve vassal.",
  ferritin:
    "A szervezet vasraktárainak tárolófehérjeje; szérum szintje a test összes vaskészletének indirekt mutatója.",
  psa:
    "A prosztata által termelt enzim; legismertebb szerepe a prosztatarák szűrőmarkereként.",
  tsh:
    "Az agyalapi mirigy hormonja, amely a pajzsmirigyet tiroxin (T4) termelésre serkenti; a pajzsmirigyműködés fő regulátora.",
  "hba1c-ifcc":
    "Glikált (cukorhoz kapcsolt) hemoglobin, IFCC egységben (mmol/mol); az elmúlt 2–3 hónap átlagos vércukorszintjét tükrözi, a cukorbetegség követésének standard mutatója.",
  "hba1c-pct":
    "Glikált (cukorhoz kapcsolt) hemoglobin, régi %-os egységben; az elmúlt 2–3 hónap átlagos vércukorszintjét tükrözi.",
  "sed-rate":
    "A vörösvértestek egy óra alatti ülepedési sebessége; nem specifikus gyulladásos marker.",
};

export function analyteDescription(id) {
  return DESCRIPTIONS[id] || "";
}
