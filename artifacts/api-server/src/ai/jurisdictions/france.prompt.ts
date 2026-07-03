/**
 * France Jurisdiction Plugin — Al-Shamsi Administrative Decision OS
 *
 * Legal framework: French administrative law (droit administratif)
 * Primary legislation:
 *   - CRPA: Code des relations entre le public et l'administration
 *   - CGFP: Code général de la fonction publique (Loi 2019-828)
 *   - Loi no 2016-1321 du 7 octobre 2016 (République Numérique)
 *   - RGPD: Règlement général sur la protection des données (UE 2016/679)
 *   - Loi 78-17 du 6 janvier 1978 (Informatique et Libertés)
 *
 * Conseil d'État principles:
 *   - Recours pour excès de pouvoir (REP)
 *   - Détournement de pouvoir
 *   - Principe de légalité, proportionnalité, non-rétroactivité
 *   - Arrêt Nicolo (1989), Arrêt Ville Nouvelle Est (1971)
 */

import type { JurisdictionPlugin, JurisdictionPluginParams } from "./index";

const francePlugin: JurisdictionPlugin = {
  jurisdictionKey: "france",
  nameAr: "الجمهورية الفرنسية",
  nameEn: "French Republic",
  legalSystem: "civil",
  active: true,

  buildJurisdictionContext(params: JurisdictionPluginParams): string {
    const { domain } = params;

    // Domain-specific French law additions
    const domainLaws: Record<string, string> = {
      personnel: `• Code général de la fonction publique (CGFP) — Loi 2019-828
• Décret no 84-961 relatif à la procédure disciplinaire concernant les fonctionnaires de l'État
• Arrêté du 14 mars 1986 relatif aux congés annuels des fonctionnaires`,
      regulatory: `• Loi no 2000-321 du 12 avril 2000 (DCRA) — droits des citoyens dans leurs relations avec l'administration
• Code de l'environnement — pour autorisations environnementales
• Code de commerce — pour autorisations commerciales`,
      citizen: `• CESEDA: Code de l'entrée et du séjour des étrangers et du droit d'asile
• Code de l'action sociale et des familles
• Loi no 2015-925 du 29 juillet 2015 relative à la réforme du droit d'asile`,
      appeals: `• CRPA art. L410-1 à L424-3 — décisions implicites (acceptation / rejet)
• CRPA art. L411-1 à L412-8 — procédure d'opposition et recours préalables
• Code de justice administrative (CJA) — recours contentieux`,
      digital: `• CRPA art. L311-3-1 — droit de ne pas faire l'objet d'une décision fondée exclusivement sur un algorithme
• Loi no 2016-1321 (République Numérique) art. 4 — transparence des algorithmes publics
• RGPD art. 22 — décisions automatisées et profilage
• Loi no 78-17 du 6 janvier 1978 (Informatique et Libertés) art. 47`,
      procurement: `• Code de la commande publique (CCP) — ordonnance 2018-1074
• Directive européenne 2014/24/UE sur la passation des marchés publics
• CRPA art. L121-1 — procédure contradictoire obligatoire`,
    };

    const domainBlock = domainLaws[domain] ?? "";

    return `النظام القانوني: القانون الإداري الفرنسي (نظام القانون المدني — Droit administratif français)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
الإطار التشريعي الفرنسي الأساسي
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• CRPA: Code des relations entre le public et l'administration (أوامر 2015-1341 و2015-1342)
  - L200-1: مبدأ الحياد والمشروعية
  - L211-2: الإلزامية العامة للتسبيب (motivation obligatoire)
  - L121-1: وجوب الإجراء التناقضي (procédure contradictoire)
  - L232-4: اشتراطات التوقيع الإلكتروني
  - L311-3-1: الحق في عدم الخضوع لقرار آلي بالكامل
• CGFP: Code général de la fonction publique — Loi no 2019-828
• Loi no 2016-1321 (République Numérique):
  - art. 4: الشفافية الخوارزمية — الإدارة ملزمة بإخبار المواطن عند استخدام خوارزمية
• RGPD (UE 2016/679) art. 22: القرارات الآلية والتنميط — حق الاعتراض
• Loi 78-17 (Informatique et Libertés) — حماية البيانات الشخصية

${domainBlock ? `تشريعات تخصصية حسب المجال:\n${domainBlock}\n` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
مبادئ مجلس الدولة الفرنسي — Conseil d'État
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Recours pour excès de pouvoir (REP): الطعن بالإلغاء لتجاوز السلطة
• Détournement de pouvoir: الانحراف بالسلطة — القرار لأهداف خارج الصالح العام
• Principe de légalité: مبدأ الشرعية — الإدارة خاضعة للقانون
• Principe de proportionnalité: التناسب — Arrêt Ville Nouvelle Est (1971)
• Principe de non-rétroactivité: عدم رجعية القرارات الإدارية
• Arrêt Nicolo (1989): أولوية القانون الأوروبي على التشريع الوطني

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
تكييف أبعاد نظرية الشامسي في الإطار الفرنسي
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. الاختصاص → Compétence
   قاعدة parallélisme des formes — الاختصاص الشكلي والموضوعي
   الاختصاص الإقليمي (compétence territoriale) + الاختصاص الذاتي (compétence ratione materiae)
   تفويض الإمضاء (délégation de signature) ≠ تفويض السلطة (délégation de pouvoir)

2. الشكل → Forme (exigences formelles)
   CRPA L211-2: التسبيب إلزامي للقرارات الفردية الضارة
   Procédure contradictoire (CRPA L121-1): الاستماع للمعني قبل القرار الضار
   Délai raisonnable: الآجال المعقولة قبل اتخاذ القرار
   Notification régulière: التبليغ الصحيح يؤثر على سريان آجال الطعن

3. السبب → Cause (faits matériels + base légale)
   Exactitude matérielle des faits: صحة الوقائع المادية التي تستند إليها الإدارة
   Qualification juridique: التكييف القانوني السليم للوقائع
   Erreur manifeste d'appréciation: الخطأ الواضح في التقدير — رقابة قضائية محدودة

4. المحل → Objet (objet licite et déterminé)
   Possibilité physique et juridique: إمكانية تنفيذ القرار ماديًا وقانونيًا
   Non-contrariété à l'ordre public: عدم مخالفة النظام العام

5. الغاية → But (pas de détournement de pouvoir)
   Intérêt général exclusif: الغاية حصراً الصالح العام
   Détournement de procédure: تحوير الإجراءات عن غرضها الأصلي

6. الإرادة الإنسانية → Volonté administrative
   Liberté de l'agent: حرية الموظف في اتخاذ القرار + غياب الإكراه الهرمي
   Délégation valide: صحة التفويض المخوّل للموظف

7. تكوين الإرادة الرقمية → Formation numérique de la volonté
   CRPA L232-4: اشتراطات التوقيع الإلكتروني المعتمد
   Acte administratif électronique: صحة القرار الإداري الصادر إلكترونيًا

8. الوزن الخوارزمي → Poids algorithmique (CRPA L311-3-1)
   ⚠️ بُعد حرج في فرنسا: CRPA art. L311-3-1 يمنع القرار الفردي الصادر حصراً عن خوارزمية
   المواطن له حق المطالبة بمراجعة بشرية للقرار الآلي
   يجب الكشف عن الخوارزمية عند الطلب (Loi République Numérique art. 4)

9. التحيز الخوارزمي → Biais algorithmique
   RGPD art. 22: الحق في الاعتراض على القرار الآلي
   Obligation d'équité: CNIL تراقب عدالة الخوارزميات الحكومية
   Non-discrimination algorithmique: حظر التمييز الخوارزمي

10. قابلية التفسير → Transparence algorithmique
    Droit de communication (Loi 78-17 art. 63 + CRPA L311-3-1):
    الإدارة ملزمة بإعلام المعني بمعايير الخوارزمية ووزنها النسبي
    CADA (Commission d'accès aux documents administratifs): حق الوصول للوثائق

11. الرقابة البشرية → Contrôle humain
    Obligation d'intervention humaine: تدخل بشري إلزامي قبل قرار آلي يمس الحقوق
    Contrôle hiérarchique interne + CNIL + Médiateur de la République

12. الجاهزية القضائية → Contentieux administratif (Conseil d'État)
    Délai de recours: عادةً 2 شهران من التبليغ (CRPA L411-2)
    Recours hiérarchique + recours gracieux قبل الطعن القضائي
    Tribunal administratif → Cour administrative d'appel → Conseil d'État
    Référé-suspension: تعليق تنفيذ القرار في حالات الاستعجال

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
تعليمات خاصة بالتقييم في النظام الفرنسي
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• استشهد بالمواد الفرنسية بالرقم الدقيق (مثل: CRPA art. L211-2, CGFP art. L530-1)
• أشر إلى أحكام مجلس الدولة (Conseil d'État) ذات الصلة عند توفرها
• اكتب governmentAuthority.nameAr باسم الوزارة أو الهيئة الفرنسية المختصة
• canIssueToday يعني "هل القرار مشروع وفق القانون الإداري الفرنسي؟"
• لكل بُعد: اربط الاشتراطات الفرنسية المحددة بدلاً من الإماراتية`;
  },
};

export default francePlugin;
