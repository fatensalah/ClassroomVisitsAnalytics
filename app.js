const sb = supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseKey);

let currentUser = null;
let currentProfile = null;
let teachers = [], departments = [], subjects = [], criteria = [], visits = [], ratings = [], feedback = [], visitSkills = [], studentWork = [], supports = [], supportFollowups = [], profiles = [];
let editingVisitId = null;
let charts = {};
let reportNarrativeDraft = { summary: "", recommendations: "" };

const REPORT_INFO = {
  preparedBy: "فاتن صلاح",
  assistantPrincipal: "خلود الكعبي",
  principal: "أحلام السويدي"
};

const SCHOOL_HEADER_IMAGE = "school-header.jpg";

const EVALUATION_KEYS = [
  1, 2, 6, 9, 10, 11, 14, 16, 18
];

const FLEXIBLE_KEYS = [
  6, 11, 14, 16, 18
];

const SKILLS = [
  ["critical_thinking", "التفكير الناقد وحل المشكلات"],
  ["collaboration_communication", "التعاون والتواصل"],
  ["creativity_innovation", "الإبداع والابتكار"],
  ["information_literacy", "المعرفة المعلوماتية"],
  ["digital_literacy", "المعرفة الرقمية"],
  ["global_cultural_awareness", "الوعي العالمي والثقافي"],
  ["adaptability_flexibility", "القدرة على التكيف والمرونة"],
  ["emotional_intelligence", "الذكاء العاطفي"]
];

const WORK_ITEMS = [
  [
    "activities_alignment",
    "ملاءمة الأنشطة ومقدارها ونوعها واتساقها مع مخرجات المنهج"
  ],
  [
    "differentiated_levels",
    "مراعاة الفروق والمستويات الأكاديمية"
  ],
  [
    "higher_thinking_research_selflearning",
    "التفكير الأعلى والبحث والاستقصاء والتعلم الذاتي"
  ],
  [
    "regular_correction",
    "انتظام التصحيح"
  ],
  [
    "constructive_feedback",
    "التغذية الراجعة البناءة وتقدير الأعمال المتميزة"
  ]
];

/* =========================================================
   HELPERS
========================================================= */

const $ = id =>
  document.getElementById(id);

const esc = (v = "") =>
  String(v ?? "").replace(
    /[&<>"']/g,
    m =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[m])
  );

const num = v =>
  Number(v || 0);

const pct = (a, b) =>
  b
    ? Math.round(
        a / b * 100
      )
    : 0;

const monthKey = d =>
  String(
    d || ""
  ).slice(
    0,
    7
  );

const monthNames = {
  "01": "يناير",
  "02": "فبراير",
  "03": "مارس",
  "04": "أبريل",
  "05": "مايو",
  "06": "يونيو",
  "07": "يوليو",
  "08": "أغسطس",
  "09": "سبتمبر",
  "10": "أكتوبر",
  "11": "نوفمبر",
  "12": "ديسمبر"
};

const monthLabel = k =>
  k
    ? `${monthNames[k.slice(5, 7)] || k.slice(5, 7)} ${k.slice(0, 4)}`
    : "";

const formatDate = d =>
  d
    ? new Date(
        `${d}T00:00:00`
      ).toLocaleDateString(
        "ar-BH"
      )
    : "—";

const ratingShort = r =>
  ({
    4: "يتجاوز التوقعات بكثير",
    3: "يتجاوز التوقعات",
    2: "يفي بالتوقعات تمامًا",
    1: "يفي بالتوقعات جزئيًا"
  }[num(r)] || "—");

const ratingLabel = r =>
  ({
    4: "يتجاوز التوقعات بكثير",
    3: "يتجاوز التوقعات",
    2: "يفي بالتوقعات تمامًا",
    1: "يفي بالتوقعات جزئيًا"
  }[num(r)] || "—");

/* =========================================================
   القيادة
========================================================= */

function leadershipLevel(
  profile
) {
  if (!profile) {
    return "لا ينطبق";
  }

  if (
    profile.leadership_level ===
      "قيادة عليا" ||
    profile.leadership_level ===
      "قيادة وسطى"
  ) {
    return profile.leadership_level;
  }

  if (
    profile.job_title ===
      "مديرة المدرسة" ||
    profile.job_title ===
      "مديرة مساعدة"
  ) {
    return "قيادة عليا";
  }

  if (
    profile.job_title ===
    "منسقة قسم"
  ) {
    return "قيادة وسطى";
  }

  return "لا ينطبق";
}

function evaluatorForVisit(
  visit
) {
  return (
    profiles.find(
      profile =>
        String(
          profile.id
        ) ===
        String(
          visit?.observer_id
        )
    ) ||
    (
      String(
        visit?.observer_id
      ) ===
      String(
        currentProfile?.id
      )
        ? currentProfile
        : null
    )
  );
}

function evaluatorName(
  visit
) {
  return (
    evaluatorForVisit(
      visit
    )?.full_name ||
    "—"
  );
}

function evaluatorLevel(
  visit
) {
  return leadershipLevel(
    evaluatorForVisit(
      visit
    )
  );
}

/* =========================================================
   MAPS
========================================================= */

function maps() {
  return {
    teachers:
      Object.fromEntries(
        teachers.map(
          item => [
            String(
              item.id
            ),
            item
          ]
        )
      ),

    departments:
      Object.fromEntries(
        departments.map(
          item => [
            String(
              item.id
            ),
            item
          ]
        )
      ),

    subjects:
      Object.fromEntries(
        subjects.map(
          item => [
            String(
              item.id
            ),
            item
          ]
        )
      )
  };
}

function activeRows(
  rows
) {
  return rows.filter(
    item =>
      item.active !== false
  );
}

/* =========================================================
   SESSION
========================================================= */

async function ensureSession() {
  const {
    data,
    error
  } =
    await sb.auth.getSession();

  if (error) {
    throw error;
  }

  if (
    !data?.session?.user
  ) {
    location.href =
      "index.html";

    return false;
  }

  currentUser =
    data.session.user;

  return true;
}

async function loadCurrentProfile() {
  const {
    data,
    error
  } =
    await sb
      .from(
        "profiles"
      )
      .select("*")
      .eq(
        "id",
        currentUser.id
      )
      .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "لم يتم العثور على ملف المستخدم."
    );
  }

  if (
    data.active === false
  ) {
    throw new Error(
      "هذا الحساب غير نشط."
    );
  }

  currentProfile =
    data;
}

/* =========================================================
   LOAD DATA
========================================================= */

async function loadAll() {
  const req =
    await Promise.all([
      sb
        .from("teachers")
        .select("*")
        .order(
          "full_name"
        ),

      sb
        .from("departments")
        .select("*")
        .order(
          "id"
        ),

      sb
        .from("subjects")
        .select("*")
        .order(
          "id"
        ),

      sb
        .from("criteria")
        .select("*")
        .order(
          "display_order"
        ),

      sb
        .from("visits")
        .select("*")
        .eq(
          "academic_year",
          APP_CONFIG.academicYear
        )
        .order(
          "visit_date",
          {
            ascending: false
          }
        ),

      sb
        .from(
          "visit_criteria"
        )
        .select("*"),

      sb
        .from(
          "visit_feedback"
        )
        .select("*"),

      sb
        .from(
          "visit_skills"
        )
        .select("*"),

      sb
        .from(
          "student_work_followup"
        )
        .select("*"),

      sb
        .from(
          "support_actions"
        )
        .select("*")
        .order(
          "support_date",
          {
            ascending: false
          }
        ),

      sb
        .from(
          "support_followups"
        )
        .select("*"),

      sb
        .from(
          "profiles"
        )
        .select("*")
        .order(
          "created_at"
        )
    ]);

  const error =
    req.find(
      item =>
        item.error
    )?.error;

  if (error) {
    throw error;
  }

  [
    teachers,
    departments,
    subjects,
    criteria,
    visits,
    ratings,
    feedback,
    visitSkills,
    studentWork,
    supports,
    supportFollowups,
    profiles
  ] =
    req.map(
      item =>
        item.data || []
    );
}

/* =========================================================
   SELECTS
========================================================= */

function setOptions(
  id,
  rows,
  placeholder,
  label = "name"
) {
  const element =
    $(id);

  if (!element) {
    return;
  }

  const old =
    element.value;

  element.innerHTML =
    `
      <option value="">
        ${esc(
          placeholder
        )}
      </option>
    `
    +
    rows
      .map(
        item => `
          <option
            value="${esc(
              item.id
            )}"
          >
            ${esc(
              item[label]
            )}
          </option>
        `
      )
      .join("");

  if (
    [...element.options]
      .some(
        option =>
          option.value ===
          old
      )
  ) {
    element.value =
      old;
  }
}

function availableMonths() {
  return [
    ...new Set(
      visits
        .map(
          visit =>
            monthKey(
              visit.visit_date
            )
        )
        .filter(
          Boolean
        )
    )
  ]
    .sort()
    .reverse();
}

function populateMonthSelectors() {
  const months =
    availableMonths();

  [
    [
      "histMonth",
      "كل الشهور"
    ],

    [
      "monthlyMonth",
      "اختاري الشهر"
    ],

    [
      "reportMonth",
      "اختاري الشهر"
    ]
  ]
    .forEach(
      (
        [
          id,
          placeholder
        ]
      ) => {
        const element =
          $(id);

        if (!element) {
          return;
        }

        const old =
          element.value;

        element.innerHTML =
          `
            <option value="">
              ${placeholder}
            </option>
          `
          +
          months
            .map(
              month => `
                <option
                  value="${month}"
                >
                  ${monthLabel(
                    month
                  )}
                </option>
              `
            )
            .join("");

        if (
          old &&
          months.includes(
            old
          )
        ) {
          element.value =
            old;
        }
        else if (
          id !==
            "histMonth" &&
          months[0]
        ) {
          element.value =
            months[0];
        }
      }
    );
}

function updateSubjectSelect(
  selected = ""
) {
  const departmentId =
    $("departmentSelect")
      ?.value ||
    "";

  const rows =
    activeRows(
      subjects
    )
      .filter(
        subject =>
          String(
            subject.department_id
          ) ===
          String(
            departmentId
          )
      );

  setOptions(
    "subjectSelect",
    rows,
    "اختاري المادة",
    "name"
  );

  if (
    $("subjectSelect")
  ) {
    $("subjectSelect").disabled =
      !departmentId;

    if (selected) {
      $("subjectSelect").value =
        String(
          selected
        );
    }
  }
}

/* =========================================================
   منفذ الزيارة
========================================================= */

function populateObserverSelector() {
  const element =
    $("visitObserverSelect");

  if (!element) {
    return;
  }

  const candidates =
    profiles.filter(
      profile =>
        profile.active !==
          false &&
        (
          leadershipLevel(
            profile
          ) !==
            "لا ينطبق" ||
          profile.role ===
            "admin"
        )
    );

  element.innerHTML =
    `
      <option value="">
        اختاري منفذ الزيارة
      </option>
    `
    +
    candidates
      .map(
        profile => `
          <option
            value="${esc(
              profile.id
            )}"
          >
            ${esc(
              profile.full_name
            )}
            —
            ${esc(
              profile.job_title ||
              leadershipLevel(
                profile
              )
            )}
          </option>
        `
      )
      .join("");

  if (
    currentProfile?.role !==
    "admin"
  ) {
    element.value =
      currentProfile?.id ||
      "";
  }
}

function selectedObserverProfile() {
  if (
    currentProfile?.role !==
    "admin"
  ) {
    return currentProfile;
  }

  const id =
    $("visitObserverSelect")
      ?.value;

  return (
    profiles.find(
      profile =>
        String(
          profile.id
        ) ===
        String(
          id
        )
    ) ||
    currentProfile
  );
}

function updateEvaluatorBlock() {
  const profile =
    selectedObserverProfile();

  if (
    $("visitEvaluatorName")
  ) {
    $("visitEvaluatorName").textContent =
      profile?.full_name ||
      "—";
  }

  if (
    $("visitEvaluatorLevel")
  ) {
    $("visitEvaluatorLevel").textContent =
      leadershipLevel(
        profile
      );
  }

  if (
    $("adminEvaluatorChooser")
  ) {
    $("adminEvaluatorChooser")
      .classList
      .toggle(
        "hidden",
        currentProfile?.role !==
          "admin"
      );
  }
}

/* =========================================================
   الدعم متعدد المعايير
========================================================= */

function renderSupportCriteriaMulti() {
  const box =
    $("supportCriteriaMulti");

  if (!box) {
    return;
  }

  box.innerHTML =
    criteria
      .map(
        criterion => `
          <label class="check-card">

            <input
              type="checkbox"
              class="support-criterion-check"
              value="${criterion.id}"
            >

            <span>
              <strong>
                م${criterion.id}
              </strong>
              —
              ${esc(
                criterion.criterion_text
              )}
            </span>

          </label>
        `
      )
      .join("");
}

function selectedSupportCriteria() {
  return [
    ...document
      .querySelectorAll(
        ".support-criterion-check:checked"
      )
  ]
    .map(
      item =>
        num(
          item.value
        )
    )
    .filter(
      Boolean
    );
}

/* =========================================================
   FILL UI
========================================================= */

function fillUI() {
  setOptions(
    "teacherSelect",
    activeRows(
      teachers
    ),
    "اختاري المعلمة",
    "full_name"
  );

  setOptions(
    "departmentSelect",
    activeRows(
      departments
    ),
    "اختاري القسم",
    "name"
  );

  setOptions(
    "histTeacher",
    activeRows(
      teachers
    ),
    "كل المعلمات",
    "full_name"
  );

  setOptions(
    "histDept",
    activeRows(
      departments
    ),
    "كل الأقسام",
    "name"
  );

  setOptions(
    "histSubject",
    activeRows(
      subjects
    ),
    "كل المواد",
    "name"
  );

  setOptions(
    "supportTeacherFilter",
    activeRows(
      teachers
    ),
    "كل المعلمات",
    "full_name"
  );

  setOptions(
    "newSubjectDept",
    activeRows(
      departments
    ),
    "اختاري القسم",
    "name"
  );

  populateMonthSelectors();

  populateAnalysisSelectors();

  populateObserverSelector();

  renderSupportCriteriaMulti();

  renderCriteria();

  updateSubjectSelect();

  updateEvaluatorBlock();
}

/* =========================================================
   CRITERIA
========================================================= */

function renderCriteria() {
  const box =
    $("criteriaContainer");

  if (!box) {
    return;
  }

  const domains =
    [
      ...new Set(
        criteria.map(
          criterion =>
            criterion.domain_name
        )
      )
    ];

  box.innerHTML =
    domains
      .map(
        domain => `
          <section
            class="criteria-domain"
          >

            <h3>
              ${esc(
                domain
              )}
            </h3>

            <div>

              ${
                criteria
                  .filter(
                    criterion =>
                      criterion.domain_name ===
                      domain
                  )
                  .map(
                    criterion => `
                      <div
                        class="criterion"
                      >

                        <div>

                          <strong>
                            م${criterion.id}
                          </strong>

                          —

                          ${esc(
                            criterion.criterion_text
                          )}

                          ${
                            criterion.is_evaluation_key
                              ? `
                                  <span class="key">
                                    مفتاح تقييم
                                  </span>
                                `
                              : ""
                          }

                        </div>

                        <div
                          class="criterion-radios"
                        >

                          ${
                            [
                              4,
                              3,
                              2,
                              1
                            ]
                              .map(
                                rating => `
                                  <label>

                                    <input
                                      type="radio"
                                      name="criterion_${criterion.id}"
                                      value="${rating}"
                                    >

                                    ${ratingShort(
                                      rating
                                    )}

                                  </label>
                                `
                              )
                              .join("")
                          }

                        </div>

                        <textarea
                          id="criterionNote_${criterion.id}"
                          placeholder="ملاحظة اختيارية"
                        ></textarea>

                      </div>
                    `
                  )
                  .join("")
              }

            </div>

          </section>
        `
      )
      .join("");
}

function collectCriterionRatings() {
  const out = {};

  criteria.forEach(
    criterion => {
      const checked =
        document.querySelector(
          `input[name="criterion_${criterion.id}"]:checked`
        );

      out[
        num(
          criterion.id
        )
      ] =
        checked
          ? num(
              checked.value
            )
          : null;
    }
  );

  return out;
}

/* =========================================================
   CONSISTENCY
========================================================= */

function allowedAtBase(
  value,
  base
) {
  value =
    num(
      value
    );

  base =
    num(
      base
    );

  if (
    !value ||
    !base
  ) {
    return false;
  }

  if (
    base === 4
  ) {
    return (
      value === 4
    );
  }

  return (
    value ===
      base ||
    value ===
      base + 1
  );
}

function consistencyForRatings(
  ratingsMap,
  overall = null
) {
  const missing =
    EVALUATION_KEYS.filter(
      key =>
        !num(
          ratingsMap[
            key
          ]
        )
    );

  if (
    missing.length
  ) {
    return {
      complete:
        false,

      consistent:
        false,

      status:
        "غير مكتمل",

      messages: [
        `استكملي مفاتيح التقييم: ${missing.join("، ")}`
      ],

      expectedOverall:
        null
    };
  }

  const base =
    Math.min(
      num(
        ratingsMap[1]
      ),
      num(
        ratingsMap[2]
      )
    );

  const messages =
    [];

  if (
    num(
      ratingsMap[9]
    ) !==
    base
  ) {
    messages.push(
      `المعيار 9 يجب أن يساوي الأقل بين 1 و2 (${ratingShort(base)}).`
    );
  }

  if (
    num(
      ratingsMap[10]
    ) !==
    base
  ) {
    messages.push(
      `المعيار 10 يجب أن يساوي الأقل بين 1 و2 (${ratingShort(base)}).`
    );
  }

  FLEXIBLE_KEYS
    .forEach(
      key => {
        if (
          !allowedAtBase(
            ratingsMap[
              key
            ],
            base
          )
        ) {
          messages.push(
            `المعيار ${key} يحتاج مراجعة مقابل نمط ${ratingShort(base)}.`
          );
        }
      }
    );

  if (
    overall &&
    num(
      overall
    ) !==
    base
  ) {
    messages.push(
      `الحكم العام المسجل (${ratingShort(overall)}) يحتاج مراجعة مقابل نمط المفاتيح (${ratingShort(base)}).`
    );
  }

  return {
    complete:
      true,

    consistent:
      messages.length ===
      0,

    status:
      messages.length
        ? "يحتاج مراجعة"
        : "متسق",

    messages,

    expectedOverall:
      base
  };
}

function ratingsForVisit(
  visitId
) {
  return ratings.filter(
    rating =>
      String(
        rating.visit_id
      ) ===
      String(
        visitId
      )
  );
}

function ratingMapForVisit(
  visitId
) {
  return Object.fromEntries(
    ratingsForVisit(
      visitId
    )
      .map(
        rating => [
          num(
            rating.criterion_no
          ),
          num(
            rating.rating
          )
        ]
      )
  );
}

function consistencyForVisit(
  visit
) {
  return consistencyForRatings(
    ratingMapForVisit(
      visit.id
    ),
    visit.overall_rating
  );
}

function updateConsistencyHint() {
  const element =
    $("consistencyHint");

  if (!element) {
    return;
  }

  const result =
    consistencyForRatings(
      collectCriterionRatings(),
      $("overallRating")
        ?.value ||
      null
    );

  if (
    !result.complete
  ) {
    element.className =
      "message";

    element.textContent =
      result.messages[0];

    return;
  }

  element.className =
    `message ${
      result.consistent
        ? "success"
        : "warn"
    }`;

  element.innerHTML =
    result.consistent
      ? `
          ✓ الرصد والحكم متسقان
          —
          النمط:
          ${ratingShort(
            result.expectedOverall
          )}
        `
      : `
          <strong>
            يحتاج مراجعة اتساق
          </strong>

          <ul>
            ${
              result.messages
                .map(
                  message =>
                    `<li>${esc(message)}</li>`
                )
                .join("")
            }
          </ul>
        `;
}

/* =========================================================
   ANALYTICS
========================================================= */

function dataSlice(
  rows
) {
  const ids =
    new Set(
      rows.map(
        visit =>
          String(
            visit.id
          )
      )
    );

  return ratings.filter(
    rating =>
      ids.has(
        String(
          rating.visit_id
        )
      )
  );
}

function distribution(
  values
) {
  const valid =
    values
      .map(
        num
      )
      .filter(
        value =>
          [
            1,
            2,
            3,
            4
          ].includes(
            value
          )
      );

  const counts = {
    1: 0,
    2: 0,
    3: 0,
    4: 0
  };

  valid.forEach(
    value =>
      counts[
        value
      ]++
  );

  const total =
    valid.length;

  return {
    count:
      total,

    excellent:
      counts[4],

    good:
      counts[3],

    satisfactory:
      counts[2],

    inappropriate:
      counts[1],

    meetsRate:
      pct(
        counts[2] +
        counts[3] +
        counts[4],
        total
      ),

    exceedsRate:
      pct(
        counts[3] +
        counts[4],
        total
      ),

    inappropriateRate:
      pct(
        counts[1],
        total
      )
  };
}

function criterionStats(
  rows
) {
  const slice =
    dataSlice(
      rows
    );

  return criteria.map(
    criterion => ({
      id:
        num(
          criterion.id
        ),

      criterion_text:
        criterion.criterion_text,

      domain_name:
        criterion.domain_name,

      ...distribution(
        slice
          .filter(
            rating =>
              num(
                rating.criterion_no
              ) ===
              num(
                criterion.id
              )
          )
          .map(
            rating =>
              rating.rating
          )
      )
    })
  );
}

function domainStats(
  rows
) {
  const slice =
    dataSlice(
      rows
    );

  return [
    ...new Set(
      criteria.map(
        criterion =>
          criterion.domain_name
      )
    )
  ]
    .map(
      domain => {
        const ids =
          new Set(
            criteria
              .filter(
                criterion =>
                  criterion.domain_name ===
                  domain
              )
              .map(
                criterion =>
                  num(
                    criterion.id
                  )
              )
          );

        return {
          domain,

          ...distribution(
            slice
              .filter(
                rating =>
                  ids.has(
                    num(
                      rating.criterion_no
                    )
                  )
              )
              .map(
                rating =>
                  rating.rating
              )
          )
        };
      }
    );
}

function teacherCoverage(
  rows = visits,
  scope = {}
) {
  const activeTeacherIds =
    new Set(
      activeRows(
        teachers
      ).map(
        teacher =>
          String(
            teacher.id
          )
      )
    );

  const teacherId =
    scope.teacherId
      ? String(
          scope.teacherId
        )
      : "";

  const departmentId =
    scope.departmentId
      ? String(
          scope.departmentId
        )
      : "";

  const visitedIds =
    new Set(
      rows
        .map(
          visit =>
            String(
              visit.teacher_id
            )
        )
        .filter(
          id =>
            activeTeacherIds.has(
              id
            )
        )
    );

  if (
    teacherId
  ) {
    const active =
      activeTeacherIds.has(
        teacherId
      );

    const visited =
      visitedIds.has(
        teacherId
      );

    return {
      total:
        active
          ? 1
          : 0,

      visited:
        active &&
        visited
          ? 1
          : 0,

      remaining:
        active &&
        !visited
          ? 1
          : 0,

      rate:
        active
          ? (
              visited
                ? 100
                : 0
            )
          : 0,

      remainingTeachers:
        active &&
        !visited
          ? activeRows(
              teachers
            ).filter(
              teacher =>
                String(
                  teacher.id
                ) ===
                teacherId
            )
          : [],

      basis:
        "teacher"
    };
  }

  if (
    departmentId
  ) {
    const candidateIds =
      new Set(
        visits
          .filter(
            visit =>
              String(
                visit.department_id
              ) ===
              departmentId
          )
          .map(
            visit =>
              String(
                visit.teacher_id
              )
          )
          .filter(
            id =>
              activeTeacherIds.has(
                id
              )
          )
      );

    const scopedVisitedIds =
      new Set(
        rows
          .filter(
            visit =>
              String(
                visit.department_id
              ) ===
              departmentId
          )
          .map(
            visit =>
              String(
                visit.teacher_id
              )
          )
          .filter(
            id =>
              candidateIds.has(
                id
              )
          )
      );

    const remainingTeachers =
      activeRows(
        teachers
      ).filter(
        teacher =>
          candidateIds.has(
            String(
              teacher.id
            )
          ) &&
          !scopedVisitedIds.has(
            String(
              teacher.id
            )
          )
      );

    return {
      total:
        candidateIds.size,

      visited:
        scopedVisitedIds.size,

      remaining:
        Math.max(
          0,
          candidateIds.size -
          scopedVisitedIds.size
        ),

      rate:
        pct(
          scopedVisitedIds.size,
          candidateIds.size
        ),

      remainingTeachers,

      basis:
        "department-observed"
    };
  }

  const activeTeachers =
    activeRows(
      teachers
    );

  return {
    total:
      activeTeachers.length,

    visited:
      visitedIds.size,

    remaining:
      Math.max(
        0,
        activeTeachers.length -
        visitedIds.size
      ),

    rate:
      pct(
        visitedIds.size,
        activeTeachers.length
      ),

    remainingTeachers:
      activeTeachers.filter(
        teacher =>
          !visitedIds.has(
            String(
              teacher.id
            )
          )
      ),

    basis:
      "school"
  };
}

function consistencySummary(
  rows
) {
  const all =
    rows.map(
      consistencyForVisit
    );

  const consistent =
    all.filter(
      item =>
        item.consistent
    ).length;

  return {
    total:
      all.length,

    consistent,

    review:
      all.filter(
        item =>
          item.complete &&
          !item.consistent
      ).length,

    incomplete:
      all.filter(
        item =>
          !item.complete
      ).length,

    rate:
      pct(
        consistent,
        all.length
      )
  };
}

function leadershipVisitStats(
  rows
) {
  let upper = 0;
  let middle = 0;
  let other = 0;

  const details =
    new Map();

  rows.forEach(
    visit => {
      const profile =
        evaluatorForVisit(
          visit
        );

      const level =
        leadershipLevel(
          profile
        );

      if (
        level ===
        "قيادة عليا"
      ) {
        upper++;
      }
      else if (
        level ===
        "قيادة وسطى"
      ) {
        middle++;
      }
      else {
        other++;
      }

      const key =
        String(
          profile?.id ||
          visit.observer_id ||
          "unknown"
        );

      if (
        !details.has(
          key
        )
      ) {
        details.set(
          key,
          {
            id:
              key,

            name:
              profile?.full_name ||
              "—",

            level,

            job_title:
              profile?.job_title ||
              "—",

            count:
              0
          }
        );
      }

      details.get(
        key
      ).count++;
    }
  );

  return {
    total:
      rows.length,

    upper,

    middle,

    other,

    upperRate:
      pct(
        upper,
        rows.length
      ),

    middleRate:
      pct(
        middle,
        rows.length
      ),

    evaluators:
      details.size,

    evaluatorDetails:
      [
        ...details.values()
      ].sort(
        (
          a,
          b
        ) =>
          b.count -
          a.count
      )
  };
}

function skillsStats(
  rows
) {
  const ids =
    new Set(
      rows.map(
        visit =>
          String(
            visit.id
          )
      )
    );

  const related =
    visitSkills.filter(
      item =>
        ids.has(
          String(
            item.visit_id
          )
        )
    );

  return SKILLS.map(
    (
      [
        key,
        label
      ]
    ) => {
      const observed =
        related.filter(
          item =>
            item[
              key
            ] ===
            true
        ).length;

      return {
        key,

        label,

        total:
          related.length,

        observed,

        rate:
          pct(
            observed,
            related.length
          )
      };
    }
  );
}

function studentWorkStats(
  rows
) {
  const ids =
    new Set(
      rows.map(
        visit =>
          String(
            visit.id
          )
      )
    );

  const related =
    studentWork.filter(
      item =>
        ids.has(
          String(
            item.visit_id
          )
        )
    );

  return WORK_ITEMS.map(
    (
      [
        key,
        label
      ]
    ) => {
      const observed =
        related.filter(
          item =>
            item[
              key
            ] ===
            true
        ).length;

      return {
        key,

        label,

        total:
          related.length,

        observed,

        rate:
          pct(
            observed,
            related.length
          )
      };
    }
  );
}

function weakestCriteria(
  rows
) {
  return criterionStats(
    rows
  )
    .filter(
      item =>
        item.count
    )
    .sort(
      (
        a,
        b
      ) =>
        b.inappropriateRate -
        a.inappropriateRate
    )
    .slice(
      0,
      5
    );
}

function strongestCriteria(
  rows
) {
  return criterionStats(
    rows
  )
    .filter(
      item =>
        item.count
    )
    .sort(
      (
        a,
        b
      ) =>
        b.exceedsRate -
        a.exceedsRate
    )
    .slice(
      0,
      5
    );
}

function supportSummary(
  rows = supports
) {
  return {
    total:
      rows.length,

    open:
      rows.filter(
        item =>
          item.status ===
          "مفتوح"
      ).length,

    follow:
      rows.filter(
        item =>
          item.status ===
          "تحت المتابعة"
      ).length,

    closed:
      rows.filter(
        item =>
          item.status ===
          "مغلق"
      ).length
  };
}

/* =========================================================
   SUPPORT COMPARISON
========================================================= */

function changeInfo(
  before,
  after
) {
  const diff =
    num(
      after
    ) -
    num(
      before
    );

  if (
    diff > 0
  ) {
    return {
      label:
        "تحسن",

      className:
        "success"
    };
  }

  if (
    diff < 0
  ) {
    return {
      label:
        "تراجع",

      className:
        "danger"
    };
  }

  return {
    label:
      "استقرار",

    className:
      "warn"
  };
}

function nextVisitForSupport(
  support
) {
  const source =
    visits.find(
      visit =>
        String(
          visit.id
        ) ===
        String(
          support.source_visit_id
        )
    );

  if (!source) {
    return null;
  }

  const laterVisits =
    visits
      .filter(
        visit =>
          String(
            visit.teacher_id
          ) ===
            String(
              support.teacher_id
            ) &&
          String(
            visit.id
          ) !==
            String(
              source.id
            ) &&
          String(
            visit.visit_date
          ) >=
            String(
              source.visit_date
            )
      )
      .sort(
        (
          a,
          b
        ) =>
          String(
            a.visit_date
          )
            .localeCompare(
              String(
                b.visit_date
              )
            )
      );

  return (
    laterVisits[0] ||
    null
  );
}

function supportObservedRow(
  support
) {
  const source =
    visits.find(
      visit =>
        String(
          visit.id
        ) ===
        String(
          support.source_visit_id
        )
    );

  if (!source) {
    return null;
  }

  const follow =
    nextVisitForSupport(
      support
    );

  const before =
    ratingMapForVisit(
      source.id
    )[
      num(
        support.criterion_no
      )
    ] ||
    null;

  const after =
    follow
      ? (
          ratingMapForVisit(
            follow.id
          )[
            num(
              support.criterion_no
            )
          ] ||
          null
        )
      : null;

  return {
    source,

    follow,

    before,

    after,

    change:
      before &&
      after
        ? changeInfo(
            before,
            after
          )
        : null
  };
}


/* =========================================================
   ADVANCED CRITERIA DISTRIBUTION + GROWTH
========================================================= */

function monthRangeOptions(
  fromId,
  toId
) {
  const months =
    availableMonths()
      .slice()
      .sort();

  const from =
    $(fromId);

  const to =
    $(toId);

  if (from) {
    const old =
      from.value;

    from.innerHTML =
      `<option value="">أول شهر متاح</option>` +
      months
        .map(
          month =>
            `<option value="${month}">${esc(monthLabel(month))}</option>`
        )
        .join("");

    if (
      old &&
      months.includes(old)
    ) {
      from.value =
        old;
    }
  }

  if (to) {
    const old =
      to.value;

    to.innerHTML =
      `<option value="">آخر شهر متاح</option>` +
      months
        .map(
          month =>
            `<option value="${month}">${esc(monthLabel(month))}</option>`
        )
        .join("");

    if (
      old &&
      months.includes(old)
    ) {
      to.value =
        old;
    }
  }
}

function populateAnalysisSelectors() {
  [
    "dashboardDeptFilter",
    "monthlyDeptFilter",
    "overallDeptFilter",
    "reportDeptFilter"
  ].forEach(
    id =>
      setOptions(
        id,
        activeRows(departments),
        "المدرسة كاملة",
        "name"
      )
  );

  [
    "dashboardTeacherFilter",
    "monthlyTeacherFilter",
    "overallTeacherFilter",
    "reportTeacherFilter"
  ].forEach(
    id =>
      setOptions(
        id,
        activeRows(teachers),
        "كل المعلمات",
        "full_name"
      )
  );

  [
    ["dashboardFromMonth", "dashboardToMonth"],
    ["overallFromMonth", "overallToMonth"],
    ["reportFromMonth", "reportToMonth"]
  ].forEach(
    pair =>
      monthRangeOptions(
        pair[0],
        pair[1]
      )
  );
}

function filterVisitsByScope(
  sourceRows,
  options = {}
) {
  const departmentId =
    String(
      options.departmentId ||
      ""
    );

  const teacherId =
    String(
      options.teacherId ||
      ""
    );

  const fromMonth =
    options.fromMonth ||
    "";

  const toMonth =
    options.toMonth ||
    "";

  return sourceRows.filter(
    visit => {
      const visitMonth =
        monthKey(
          visit.visit_date
        );

      if (
        departmentId &&
        String(
          visit.department_id
        ) !==
        departmentId
      ) {
        return false;
      }

      if (
        teacherId &&
        String(
          visit.teacher_id
        ) !==
        teacherId
      ) {
        return false;
      }

      if (
        fromMonth &&
        visitMonth <
        fromMonth
      ) {
        return false;
      }

      if (
        toMonth &&
        visitMonth >
        toMonth
      ) {
        return false;
      }

      return true;
    }
  );
}

function scopeLabel(
  departmentId,
  teacherId
) {
  const map =
    maps();

  if (
    teacherId
  ) {
    return (
      map.teachers[
        String(
          teacherId
        )
      ]?.full_name ||
      "المعلمة المحددة"
    );
  }

  if (
    departmentId
  ) {
    return (
      map.departments[
        String(
          departmentId
        )
      ]?.name ||
      "القسم المحدد"
    );
  }

  return "المدرسة كاملة";
}

function dashboardFilteredRows() {
  return filterVisitsByScope(
    visits,
    {
      departmentId:
        $("dashboardDeptFilter")
          ?.value ||
        "",

      teacherId:
        $("dashboardTeacherFilter")
          ?.value ||
        "",

      fromMonth:
        $("dashboardFromMonth")
          ?.value ||
        "",

      toMonth:
        $("dashboardToMonth")
          ?.value ||
        ""
    }
  );
}

function overallFilteredRows() {
  return filterVisitsByScope(
    visits,
    {
      departmentId:
        $("overallDeptFilter")
          ?.value ||
        "",

      teacherId:
        $("overallTeacherFilter")
          ?.value ||
        "",

      fromMonth:
        $("overallFromMonth")
          ?.value ||
        "",

      toMonth:
        $("overallToMonth")
          ?.value ||
        ""
    }
  );
}

function monthlyScopeRows(
  month
) {
  return filterVisitsByScope(
    visits,
    {
      departmentId:
        $("monthlyDeptFilter")
          ?.value ||
        "",

      teacherId:
        $("monthlyTeacherFilter")
          ?.value ||
        "",

      fromMonth:
        month,

      toMonth:
        month
    }
  );
}

function monthlyGrowthRows(
  selectedMonth
) {
  const filtered =
    filterVisitsByScope(
      visits,
      {
        departmentId:
          $("monthlyDeptFilter")
            ?.value ||
          "",

        teacherId:
          $("monthlyTeacherFilter")
            ?.value ||
          ""
      }
    );

  const months =
    [
      ...new Set(
        filtered
          .map(
            visit =>
              monthKey(
                visit.visit_date
              )
          )
          .filter(Boolean)
      )
    ]
      .sort();

  const index =
    months.indexOf(
      selectedMonth
    );

  if (
    index <= 0
  ) {
    return filtered.filter(
      visit =>
        monthKey(
          visit.visit_date
        ) ===
        selectedMonth
    );
  }

  const previous =
    months[
      index - 1
    ];

  return filtered.filter(
    visit => {
      const month =
        monthKey(
          visit.visit_date
        );

      return (
        month ===
          previous ||
        month ===
          selectedMonth
      );
    }
  );
}

function ratingLevelName(
  rating
) {
  return ({
    1: "يفي بالتوقعات جزئيًا",
    2: "يفي بالتوقعات تمامًا",
    3: "يتجاوز التوقعات",
    4: "يتجاوز التوقعات بكثير"
  })[num(rating)] || "—";
}

function criterionMonthlyDistribution(
  rows,
  criterionId
) {
  const visitIds =
    new Set(
      rows.map(
        visit =>
          String(
            visit.id
          )
      )
    );

  const values =
    ratings
      .filter(
        item =>
          visitIds.has(
            String(
              item.visit_id
            )
          ) &&
          num(
            item.criterion_no
          ) ===
          num(
            criterionId
          )
      )
      .map(
        item =>
          num(
            item.rating
          )
      )
      .filter(
        value =>
          value >= 1 &&
          value <= 4
      );

  const counts = {
    1: 0,
    2: 0,
    3: 0,
    4: 0
  };

  values.forEach(
    value =>
      counts[value]++
  );

  const total =
    values.length;

  const percentages = {};

  [
    1,
    2,
    3,
    4
  ].forEach(
    level => {
      percentages[level] =
        total
          ? Math.round(
              (
                counts[level] /
                total
              ) *
              1000
            ) / 10
          : null;
    }
  );

  if (!total) {
    return {
      total: 0,
      counts,
      percentages,
      modes: [],
      modeRate: null
    };
  }

  const maxCount =
    Math.max(
      ...Object.values(
        counts
      )
    );

  const modes =
    [
      1,
      2,
      3,
      4
    ].filter(
      level =>
        counts[level] ===
        maxCount
    );

  return {
    total,
    counts,
    percentages,
    modes,
    modeRate:
      Math.round(
        (
          maxCount /
          total
        ) *
        1000
      ) / 10
  };
}

function modalLevelText(
  stat
) {
  if (
    !stat ||
    !stat.total ||
    !stat.modes?.length
  ) {
    return "—";
  }

  const names = stat.modes
    .map(
      ratingLevelName
    )
    .join(" / ");

  return `${names} ${stat.modeRate}%`;
}

function distributionCenter(
  stat
) {
  if (
    !stat ||
    !stat.total
  ) {
    return null;
  }

  return [1, 2, 3, 4]
    .reduce(
      (
        total,
        level
      ) =>
        total +
        level *
          (stat.percentages[level] || 0),
      0
    ) / 100;
}

function compareMonthlyCriterion(
  fromStat,
  toStat
) {
  if (
    !fromStat?.total ||
    !toStat?.total
  ) {
    return {
      status: "بيانات غير كافية",
      className: "growth-na",
      detail: "لا تتوافر بيانات كافية للمقارنة بين الشهرين."
    };
  }

  const fromModes =
    fromStat.modes || [];
  const toModes =
    toStat.modes || [];

  const fromMin = Math.min(
    ...fromModes
  );
  const fromMax = Math.max(
    ...fromModes
  );
  const toMin = Math.min(
    ...toModes
  );
  const toMax = Math.max(
    ...toModes
  );

  if (
    toMin >
    fromMax
  ) {
    return {
      status: "تحسن",
      className: "growth-up",
      detail: `انتقل النمط الغالب من ${modalLevelText(fromStat)} إلى ${modalLevelText(toStat)}.`
    };
  }

  if (
    toMax <
    fromMin
  ) {
    return {
      status: "تراجع",
      className: "growth-down",
      detail: `انتقل النمط الغالب من ${modalLevelText(fromStat)} إلى ${modalLevelText(toStat)}.`
    };
  }

  const before =
    distributionCenter(
      fromStat
    );
  const after =
    distributionCenter(
      toStat
    );
  const change =
    after !== null &&
    before !== null
      ? after - before
      : 0;

  if (
    change > 0.001
  ) {
    return {
      status: "تحسن في التوزيع",
      className: "growth-up",
      detail: "ظل النمط الغالب ثابتًا أو متعادلًا، مع انتقال نسبي للتقديرات نحو مستويات أعلى."
    };
  }

  if (
    change < -0.001
  ) {
    return {
      status: "تراجع في التوزيع",
      className: "growth-down",
      detail: "ظل النمط الغالب ثابتًا أو متعادلًا، مع انتقال نسبي للتقديرات نحو مستويات أدنى."
    };
  }

  return {
    status: "استقرار",
    className: "growth-flat",
    detail: "لم يظهر تغير في اتجاه توزيع مستويات الحكم بين الشهرين."
  };
}

function criterionGrowthStats(
  rows
) {
  const months = [
    ...new Set(
      rows
        .map(
          visit =>
            monthKey(
              visit.visit_date
            )
        )
        .filter(Boolean)
    )
  ].sort();

  return criteria.map(
    criterion => {
      const monthly =
        months.map(
          month => {
            const monthRows =
              rows.filter(
                visit =>
                  monthKey(
                    visit.visit_date
                  ) ===
                  month
              );

            const stat =
              criterionMonthlyDistribution(
                monthRows,
                criterion.id
              );

            return {
              month,
              ...stat,
              modalText:
                modalLevelText(
                  stat
                )
            };
          }
        );

      const transitions = [];

      for (
        let i = 0;
        i < months.length - 1;
        i++
      ) {
        const from = monthly[i];
        const to = monthly[i + 1];
        const reading =
          compareMonthlyCriterion(
            from,
            to
          );

        transitions.push({
          fromMonth:
            months[i],
          toMonth:
            months[i + 1],
          ...reading
        });
      }

      return {
        id:
          num(
            criterion.id
          ),
        criterion_text:
          criterion.criterion_text,
        domain_name:
          criterion.domain_name,
        monthly,
        transitions
      };
    }
  );
}

function criteriaReading(
  rows,
  growthRows,
  label = ""
) {
  if (!rows.length) {
    return "لا توجد زيارات ضمن النطاق المحدد حتى الآن.";
  }

  const stats =
    criterionStats(
      rows
    ).filter(
      item =>
        item.count > 0
    );

  if (!stats.length) {
    return "لا توجد أرصاد معايير كافية لإصدار قراءة تحليلية.";
  }

  const growth =
    criterionGrowthStats(
      growthRows
    );

  const transitions =
    growth.flatMap(
      item =>
        (item.transitions || [])
          .filter(
            transition =>
              transition.status !==
              "بيانات غير كافية"
          )
          .map(
            transition => ({
              criterionId:
                item.id,
              ...transition
            })
          )
    );

  const improving =
    transitions.filter(
      item =>
        item.status.startsWith(
          "تحسن"
        )
    ).length;

  const declining =
    transitions.filter(
      item =>
        item.status.startsWith(
          "تراجع"
        )
    ).length;

  const stable =
    transitions.filter(
      item =>
        item.status ===
        "استقرار"
    ).length;

  const currentModes =
    criteria.map(
      criterion => {
        const stat =
          criterionMonthlyDistribution(
            rows,
            criterion.id
          );
        return {
          id: num(criterion.id),
          stat,
          center:
            distributionCenter(
              stat
            )
        };
      }
    ).filter(
      item =>
        item.stat.total > 0
    );

  const highest =
    currentModes.length
      ? [...currentModes]
          .sort(
            (a, b) =>
              b.center -
              a.center
          )[0]
      : null;

  const lowest =
    currentModes.length
      ? [...currentModes]
          .sort(
            (a, b) =>
              a.center -
              b.center
          )[0]
      : null;

  const parts = [];

  if (
    highest &&
    lowest
  ) {
    parts.push(
      `${label ? `في ${label}، ` : ""}ظهر أعلى نمط أداء في المعيار م${highest.id} عند ${modalLevelText(highest.stat)}، بينما ظهر أدنى نمط أداء في المعيار م${lowest.id} عند ${modalLevelText(lowest.stat)}.`
    );
  }

  if (
    transitions.length
  ) {
    parts.push(
      `عبر المقارنات الشهرية المتتالية للمعايير من م1 إلى م18، سُجلت ${improving} حالة تحسن، و${stable} حالة استقرار، و${declining} حالة تراجع.`
    );
  }
  else {
    parts.push(
      "لا تتوافر بيانات لشهرين متتاليين على الأقل لإصدار قراءة تطور زمنية."
    );
  }

  return parts.join(" ");
}

function heatCellStyle(
  level,
  rate
) {
  const value =
    Math.max(
      0,
      Math.min(
        100,
        Number(
          rate || 0
        )
      )
    );

  const alpha =
    0.12 +
    (
      value /
      100
    ) *
    0.55;

  const rgb = {
    1: "190,70,70",
    2: "205,154,55",
    3: "72,145,112",
    4: "21,105,112"
  }[level] || "120,120,120";

  return `background:rgba(${rgb},${alpha.toFixed(2)});font-weight:700;text-align:center;`;
}

function criteriaDistributionTableHTML(
  rows
) {
  const stats =
    criterionStats(
      rows
    );

  const dStats =
    domainStats(
      rows
    );

  const domains = [
    ...new Set(
      criteria.map(
        criterion =>
          criterion.domain_name
      )
    )
  ];

  const body =
    domains.map(
      domain => {
        const domainCriteria =
          stats.filter(
            item =>
              item.domain_name ===
              domain
          );

        const domainRow =
          dStats.find(
            item =>
              item.domain ===
              domain
          );

        const dCount =
          domainRow?.count || 0;

        const d1 =
          pct(
            domainRow?.inappropriate || 0,
            dCount
          );

        const d2 =
          pct(
            domainRow?.satisfactory || 0,
            dCount
          );

        const d3 =
          pct(
            domainRow?.good || 0,
            dCount
          );

        const d4 =
          pct(
            domainRow?.excellent || 0,
            dCount
          );

        return `
          <tr class="domain-row">
            <td>
              <strong>
                ${esc(domain)}
              </strong>
            </td>

            <td>
              <strong>
                ${dCount || "—"}
              </strong>
            </td>

            <td style="${heatCellStyle(1,d1)}">
              ${dCount ? `${d1}%` : "—"}
            </td>

            <td style="${heatCellStyle(2,d2)}">
              ${dCount ? `${d2}%` : "—"}
            </td>

            <td style="${heatCellStyle(3,d3)}">
              ${dCount ? `${d3}%` : "—"}
            </td>

            <td style="${heatCellStyle(4,d4)}">
              ${dCount ? `${d4}%` : "—"}
            </td>
          </tr>

          ${
            domainCriteria.map(
              item => {
                const r1 =
                  pct(
                    item.inappropriate,
                    item.count
                  );

                const r2 =
                  pct(
                    item.satisfactory,
                    item.count
                  );

                const r3 =
                  pct(
                    item.good,
                    item.count
                  );

                const r4 =
                  pct(
                    item.excellent,
                    item.count
                  );

                return `
                  <tr>
                    <td>
                      <strong>
                        م${item.id}
                      </strong>
                      —
                      ${esc(
                        item.criterion_text
                      )}
                    </td>

                    <td>
                      ${item.count || "—"}
                    </td>

                    <td style="${heatCellStyle(1,r1)}">
                      ${item.count ? `${r1}%` : "—"}
                    </td>

                    <td style="${heatCellStyle(2,r2)}">
                      ${item.count ? `${r2}%` : "—"}
                    </td>

                    <td style="${heatCellStyle(3,r3)}">
                      ${item.count ? `${r3}%` : "—"}
                    </td>

                    <td style="${heatCellStyle(4,r4)}">
                      ${item.count ? `${r4}%` : "—"}
                    </td>
                  </tr>
                `;
              }
            ).join("")
          }
        `;
      }
    ).join("");

  return `
    <div class="criteria-table-wrap">

      <table class="criteria-distribution-table">

        <thead>

          <tr>
            <th>
              المجال / المعيار
            </th>

            <th>
              عدد الأرصاد
            </th>

            <th>
              يفي بالتوقعات جزئيًا
            </th>

            <th>
              يفي بالتوقعات تمامًا
            </th>

            <th>
              يتجاوز التوقعات
            </th>

            <th>
              يتجاوز التوقعات بكثير
            </th>
          </tr>

        </thead>

        <tbody>
          ${body}
        </tbody>

      </table>

    </div>

    <div
      class="scope-note"
      style="
        margin-top:8px;
        font-size:12px;
      "
    >
      كلما زادت شدة لون الخلية زادت نسبة ظهور مستوى الحكم داخل المعيار أو المجال.
    </div>
  `;
}

function growthSummaryHTML(
  growth
) {
  const transitions =
    growth.flatMap(
      item =>
        item.transitions || []
    ).filter(
      item =>
        item.status !==
        "بيانات غير كافية"
    );

  const improving =
    transitions.filter(
      item =>
        item.status.startsWith(
          "تحسن"
        )
    ).length;

  const stable =
    transitions.filter(
      item =>
        item.status ===
        "استقرار"
    ).length;

  const declining =
    transitions.filter(
      item =>
        item.status.startsWith(
          "تراجع"
        )
    ).length;

  return `
    <div class="growth-summary-grid">
      <div class="growth-summary-card">
        <span>مقارنات شهرية متاحة</span>
        <strong>${transitions.length}</strong>
      </div>
      <div class="growth-summary-card">
        <span>تحسن</span>
        <strong>${improving}</strong>
      </div>
      <div class="growth-summary-card">
        <span>استقرار</span>
        <strong>${stable}</strong>
      </div>
      <div class="growth-summary-card">
        <span>تراجع</span>
        <strong>${declining}</strong>
      </div>
    </div>
  `;
}

function criteriaGrowthTableHTML(
  rows
) {
  const growth =
    criterionGrowthStats(
      rows
    );

  const months = [
    ...new Set(
      rows
        .map(
          visit =>
            monthKey(
              visit.visit_date
            )
        )
        .filter(Boolean)
    )
  ].sort();

  if (
    months.length < 2
  ) {
    return `
      ${growthSummaryHTML(growth)}
      <p class="scope-note">
        يلزم وجود بيانات في شهرين على الأقل لقراءة التطور بين الفترات.
      </p>
    `;
  }

  let headers =
    "<th>المعيار</th>";

  months.forEach(
    (month, index) => {
      headers +=
        `<th>${esc(monthLabel(month))}<br><small>النمط الغالب</small></th>`;

      if (
        index <
        months.length - 1
      ) {
        headers +=
          `<th>قراءة التطور<br><small>${esc(monthLabel(month))} ← ${esc(monthLabel(months[index + 1]))}</small></th>`;
      }
    }
  );

  const body =
    growth.map(
      item => {
        const monthMap =
          Object.fromEntries(
            item.monthly.map(
              entry => [
                entry.month,
                entry
              ]
            )
          );

        const transitionMap =
          Object.fromEntries(
            item.transitions.map(
              entry => [
                `${entry.fromMonth}|${entry.toMonth}`,
                entry
              ]
            )
          );

        let cells = `
          <td>
            <strong>م${item.id}</strong>
            — ${esc(item.criterion_text)}
          </td>`;

        months.forEach(
          (month, index) => {
            const point =
              monthMap[month];

            cells += `
              <td>
                ${point?.total ? esc(point.modalText) : "—"}
              </td>`;

            if (
              index <
              months.length - 1
            ) {
              const transition =
                transitionMap[
                  `${month}|${months[index + 1]}`
                ];

              cells += `
                <td class="${transition?.className || "growth-na"}">
                  <strong>${esc(transition?.status || "بيانات غير كافية")}</strong>
                  ${transition?.detail ? `<div class="small">${esc(transition.detail)}</div>` : ""}
                </td>`;
            }
          }
        );

        return `<tr>${cells}</tr>`;
      }
    ).join("");

  return `
    ${growthSummaryHTML(growth)}
    <p class="scope-note">
      يعتمد التطور على المستوى الأكثر تكرارًا ونسبته لكل معيار في كل شهر، وتظهر قراءة مستقلة بين كل شهرين متتاليين. وعند ثبات أو تعادل النمط الغالب تُقرأ حركة التوزيع الكامل للمستويات الأربعة قبل تحديد الاتجاه.
    </p>
    <div class="criteria-table-wrap">
      <table class="criteria-growth-table">
        <thead>
          <tr>${headers}</tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function criteriaIntelligenceHTML(
  distributionRows,
  growthRows,
  label = ""
) {
  return `
    <div class="criteria-reading-box">
      <strong>القراءة التحليلية:</strong>
      ${esc(
        criteriaReading(
          distributionRows,
          growthRows,
          label
        )
      )}
    </div>

    <h4>توزيع مستويات الأداء في المعايير م1–م18</h4>
    ${criteriaDistributionTableHTML(distributionRows)}

    <h4 style="margin-top:22px">تتبع النمو الشهري في المعايير م1–م18</h4>
    ${criteriaGrowthTableHTML(growthRows)}
  `;
}

function renderDashboardCriteriaAnalytics(
  rows
) {
  const root =
    $("dashboardCriteriaAnalytics");

  if (!root) {
    return;
  }

  const departmentId =
    $("dashboardDeptFilter")
      ?.value ||
    "";

  const teacherId =
    $("dashboardTeacherFilter")
      ?.value ||
    "";

  root.innerHTML =
    criteriaIntelligenceHTML(
      rows,
      rows,
      scopeLabel(
        departmentId,
        teacherId
      )
    );
}


/* =========================================================
   CHART HELPERS
========================================================= */

function destroyChart(
  id
) {
  if (
    charts[
      id
    ]
  ) {
    charts[
      id
    ].destroy();

    delete charts[
      id
    ];
  }
}

function makeChart(
  id,
  type,
  labels,
  data,
  label
) {
  const canvas =
    $(id);

  if (
    !canvas ||
    !window.Chart
  ) {
    return;
  }

  destroyChart(
    id
  );

  charts[
    id
  ] =
    new Chart(
      canvas,
      {
        type,

        data: {
          labels,

          datasets: [
            {
              label,
              data
            }
          ]
        },

        options: {
          responsive:
            true,

          maintainAspectRatio:
            false,

          plugins: {
            legend: {
              display:
                false
            }
          }
        }
      }
    );
}

function setKpi(
  id,
  value,
  sub = ""
) {
  const element =
    $(id);

  if (!element) {
    return;
  }

  const valueElement =
    element.querySelector(
      ".kpi-value"
    ) ||
    element.querySelector(
      "strong"
    );

  if (
    valueElement
  ) {
    valueElement.textContent =
      value;
  }

  const subElement =
    element.querySelector(
      ".kpi-sub"
    );

  if (
    subElement
  ) {
    subElement.textContent =
      sub;
  }
}

function listCards(
  items,
  renderer
) {
  return items.length
    ? items
        .map(
          renderer
        )
        .join("")
    : `
        <div class="empty-state">
          لا توجد بيانات كافية بعد.
        </div>
      `;
}

/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {
  const rows =
    dashboardFilteredRows();

  const coverage =
    teacherCoverage(
      rows,
      {
        departmentId:
          $("dashboardDeptFilter")
            ?.value ||
          "",

        teacherId:
          $("dashboardTeacherFilter")
            ?.value ||
          ""
      }
    );

  const consistency =
    consistencySummary(
      rows
    );

  const leadership =
    leadershipVisitStats(
      rows
    );

  const support =
    supportSummary();

  renderDashboardCriteriaAnalytics(
    rows
  );

  setKpi(
    "kpiVisits",
    rows.length,
    `العليا ${leadership.upper} • الوسطى ${leadership.middle}`
  );

  setKpi(
    "kpiCoverage",
    `${coverage.rate}%`,
    `${coverage.visited} من ${coverage.total}`
  );

  setKpi(
    "kpiDepartments",
    new Set(
      rows.map(
        visit =>
          visit.department_id
      )
    ).size
  );

  setKpi(
    "kpiConsistency",
    `${consistency.rate}%`
  );

  setKpi(
    "kpiSupport",
    support.open +
    support.follow
  );

  setKpi(
    "kpiTeachers",
    coverage.visited
  );

  const judgmentData =
    [
      4,
      3,
      2,
      1
    ]
      .map(
        rating =>
          rows.filter(
            visit =>
              num(
                visit.overall_rating
              ) ===
              rating
          ).length
      );

  makeChart(
    "judgmentChart",
    "doughnut",
    [
      "يتجاوز التوقعات بكثير",
      "يتجاوز التوقعات",
      "يفي بالتوقعات تمامًا",
      "يفي بالتوقعات جزئيًا"
    ],
    judgmentData,
    "الزيارات"
  );

  const domains =
    domainStats(
      rows
    );

  makeChart(
    "domainChart",
    "bar",
    domains.map(
      item =>
        item.domain
    ),
    domains.map(
      item =>
        item.meetsRate
    ),
    "يفي بالتوقعات تمامًا فأعلى %"
  );

  const skills =
    skillsStats(
      rows
    );

  makeChart(
    "skillsChart",
    "bar",
    skills.map(
      item =>
        item.label
    ),
    skills.map(
      item =>
        item.rate
    ),
    "نسبة الظهور %"
  );

  const work =
    studentWorkStats(
      rows
    );

  makeChart(
    "studentWorkChart",
    "bar",
    work.map(
      item =>
        item.label
    ),
    work.map(
      item =>
        item.rate
    ),
    "نسبة الظهور %"
  );

  makeChart(
    "coverageChart",
    "doughnut",
    [
      "تمت الزيارة",
      "لم تتم"
    ],
    [
      coverage.visited,
      coverage.remaining
    ],
    "المعلمات"
  );

  if (
    $("criteriaHeatmap")
  ) {
    $("criteriaHeatmap").innerHTML =
      criterionStats(
        rows
      )
        .map(
          item => {
            const modal =
              criterionMonthlyDistribution(
                rows,
                item.id
              );

            const dominantLevel =
              modal.modes?.length === 1
                ? modal.modes[0]
                : (
                    modal.modes?.length
                      ? Math.max(
                          ...modal.modes
                        )
                      : 0
                  );

            const dominantRate =
              modal.modeRate ||
              0;

            const rgb = {
              1: "190,70,70",
              2: "205,154,55",
              3: "72,145,112",
              4: "21,105,112"
            }[dominantLevel] ||
            "120,120,120";

            const alpha =
              0.18 +
              (
                dominantRate /
                100
              ) *
              0.62;

            return `
              <div
                class="heat-cell"
                style="
                  background:rgba(${rgb},${alpha.toFixed(2)});
                  border:1px solid rgba(${rgb},0.42);
                  border-radius:12px;
                  padding:12px;
                "
              >

                <strong>
                  م${item.id}
                </strong>

                <span>
                  ${
                    modal.total
                      ? `${esc(modalLevelText(modal))}`
                      : "لا توجد بيانات"
                  }
                </span>

              </div>
            `;
          }
        )
        .join("");
  }

  if (
    $("topGaps")
  ) {
    $("topGaps").innerHTML =
      listCards(
        weakestCriteria(
          rows
        ),
        item => `
          <div class="insight-row">

            <strong>
              م${item.id}
              —
              ${esc(
                item.criterion_text
              )}
            </strong>

            <span>
              ${item.inappropriateRate}% يفي بالتوقعات جزئيًا
            </span>

          </div>
        `
      );
  }

  if (
    $("topStrengths")
  ) {
    $("topStrengths").innerHTML =
      listCards(
        strongestCriteria(
          rows
        ),
        item => `
          <div class="insight-row">

            <strong>
              م${item.id}
              —
              ${esc(
                item.criterion_text
              )}
            </strong>

            <span>
              ${item.exceedsRate}% يتجاوز التوقعات
            </span>

          </div>
        `
      );
  }

  if (
    $("skillsWeakest")
  ) {
    $("skillsWeakest").innerHTML =
      listCards(
        [
          ...skills
        ]
          .sort(
            (
              a,
              b
            ) =>
              a.rate -
              b.rate
          )
          .slice(
            0,
            4
          ),
        item => `
          <div class="insight-row">

            <strong>
              ${esc(
                item.label
              )}
            </strong>

            <span>
              ${item.rate}%
            </span>

          </div>
        `
      );
  }

  if (
    $("studentWorkWeakest")
  ) {
    $("studentWorkWeakest").innerHTML =
      listCards(
        [
          ...work
        ]
          .sort(
            (
              a,
              b
            ) =>
              a.rate -
              b.rate
          )
          .slice(
            0,
            4
          ),
        item => `
          <div class="insight-row">

            <strong>
              ${esc(
                item.label
              )}
            </strong>

            <span>
              ${item.rate}%
            </span>

          </div>
        `
      );
  }

  if (
    $("evaluationKeysAnalysis")
  ) {
    $("evaluationKeysAnalysis").innerHTML =
      criterionStats(
        rows
      )
        .filter(
          item =>
            EVALUATION_KEYS.includes(
              item.id
            )
        )
        .map(
          item => `
            <div class="analysis-card">

              <strong>
                م${item.id}
              </strong>

              <span>
                ${item.meetsRate}% يفي بالتوقعات تمامًا فأعلى
              </span>

            </div>
          `
        )
        .join("");
  }

  if (
    $("unvisitedTeachers")
  ) {
    $("unvisitedTeachers").innerHTML =
      listCards(
        coverage.remainingTeachers,
        teacher => `
          <div class="person-item">
            ${esc(
              teacher.full_name
            )}
          </div>
        `
      );
  }

  if (
    $("supportSnapshot")
  ) {
    $("supportSnapshot").innerHTML =
      `
        <div>
          <strong>
            ${support.open}
          </strong>
          <span>
            مفتوح
          </span>
        </div>

        <div>
          <strong>
            ${support.follow}
          </strong>
          <span>
            تحت المتابعة
          </span>
        </div>

        <div>
          <strong>
            ${support.closed}
          </strong>
          <span>
            مغلق
          </span>
        </div>
      `;
  }

  if (
    $("supportImpactSummary")
  ) {
    const observed =
      supports
        .map(
          supportObservedRow
        )
        .filter(
          item =>
            item?.change
        );

    const improved =
      observed.filter(
        item =>
          item.change.label ===
          "تحسن"
      ).length;

    const stable =
      observed.filter(
        item =>
          item.change.label ===
          "استقرار"
      ).length;

    const declined =
      observed.filter(
        item =>
          item.change.label ===
          "تراجع"
      ).length;

    $("supportImpactSummary").innerHTML =
      `
        <div class="support-stats">

          <div>
            <strong>
              ${improved}
            </strong>
            <span>
              تحسن
            </span>
          </div>

          <div>
            <strong>
              ${stable}
            </strong>
            <span>
              استقرار
            </span>
          </div>

          <div>
            <strong>
              ${declined}
            </strong>
            <span>
              تراجع
            </span>
          </div>

        </div>
      `;
  }

  if (
    $("recentVisits")
  ) {
    const map =
      maps();

    $("recentVisits").innerHTML =
      listCards(
        rows.slice(
          0,
          6
        ),
        visit => `
          <div class="insight-row">

            <strong>
              ${esc(
                map.teachers[
                  String(
                    visit.teacher_id
                  )
                ]?.full_name ||
                "—"
              )}
            </strong>

            <span>
              ${formatDate(
                visit.visit_date
              )}
              •
              ${esc(
                evaluatorName(
                  visit
                )
              )}
            </span>

          </div>
        `
      );
  }

  if (
    $("leadershipInsights")
  ) {
    $("leadershipInsights").innerHTML =
      `
        <div class="insight-row">

          <strong>
            زيارات القيادة العليا
          </strong>

          <span>
            ${leadership.upper}
          </span>

        </div>

        <div class="insight-row">

          <strong>
            زيارات القيادة الوسطى
          </strong>

          <span>
            ${leadership.middle}
          </span>

        </div>

        <div class="insight-row">

          <strong>
            زيارات لا تنطبق قياديًا
          </strong>

          <span>
            ${leadership.other}
          </span>

        </div>
      `;
  }

  if (
    $("leadershipDecisionTitle")
  ) {
    const gaps =
      weakestCriteria(
        rows
      );

    $("leadershipDecisionTitle").textContent =
      gaps[0]
        ? `أولوية المتابعة: المعيار ${gaps[0].id}`
        : "استكمال التغطية أولًا";

    $("leadershipDecisionText").textContent =
      gaps[0]
        ? gaps[0].criterion_text
        : `تمت زيارة ${coverage.visited} من ${coverage.total} معلمة.`;

    $("leadershipDecisionBadge").textContent =
      gaps[0] &&
      gaps[0].inappropriateRate >=
        40
        ? "أولوية مرتفعة"
        : "متابعة";
  }
}

/* =========================================================
   HISTORY
========================================================= */

function filteredHistory() {
  return visits.filter(
    visit =>
      (
        !$("histMonth")
          ?.value ||
        monthKey(
          visit.visit_date
        ) ===
        $("histMonth")
          .value
      ) &&
      (
        !$("histTeacher")
          ?.value ||
        String(
          visit.teacher_id
        ) ===
        $("histTeacher")
          .value
      ) &&
      (
        !$("histDept")
          ?.value ||
        String(
          visit.department_id
        ) ===
        $("histDept")
          .value
      ) &&
      (
        !$("histSubject")
          ?.value ||
        String(
          visit.subject_id
        ) ===
        $("histSubject")
          .value
      ) &&
      (
        !$("histRating")
          ?.value ||
        String(
          visit.overall_rating
        ) ===
        $("histRating")
          .value
      )
  );
}

function renderHistory() {
  const box =
    $("historyTable");

  if (!box) {
    return;
  }

  const rows =
    filteredHistory();

  const map =
    maps();

  if (
    $("historyCount")
  ) {
    $("historyCount").textContent =
      `${rows.length} زيارة`;
  }

  box.innerHTML =
    `
      <div class="table-wrap">

        <table>

          <thead>

            <tr>
              <th>التاريخ</th>
              <th>المعلمة</th>
              <th>القسم</th>
              <th>المادة</th>
              <th>الحكم</th>
              <th>المقيم</th>
              <th>المستوى</th>
              <th>إجراءات</th>
            </tr>

          </thead>

          <tbody>

            ${
              rows
                .map(
                  visit => `
                    <tr>

                      <td>
                        ${formatDate(
                          visit.visit_date
                        )}
                      </td>

                      <td>
                        ${esc(
                          map.teachers[
                            String(
                              visit.teacher_id
                            )
                          ]?.full_name ||
                          "—"
                        )}
                      </td>

                      <td>
                        ${esc(
                          map.departments[
                            String(
                              visit.department_id
                            )
                          ]?.name ||
                          "—"
                        )}
                      </td>

                      <td>
                        ${esc(
                          map.subjects[
                            String(
                              visit.subject_id
                            )
                          ]?.name ||
                          "—"
                        )}
                      </td>

                      <td>
                        ${ratingShort(
                          visit.overall_rating
                        )}
                      </td>

                      <td>
                        ${esc(
                          evaluatorName(
                            visit
                          )
                        )}
                      </td>

                      <td>
                        ${esc(
                          evaluatorLevel(
                            visit
                          )
                        )}
                      </td>

                      <td>

                        <button
                          onclick="viewVisit('${visit.id}')"
                        >
                          عرض
                        </button>

                        <button
                          onclick="editVisit('${visit.id}')"
                        >
                          تعديل
                        </button>

                        <button
                          onclick="printVisitForm('${visit.id}')"
                        >
                          طباعة الاستمارة
                        </button>

                        ${
                          currentProfile?.role ===
                          "admin"
                            ? `
                                <button
                                  onclick="deleteVisit('${visit.id}')"
                                >
                                  حذف
                                </button>
                              `
                            : ""
                        }

                      </td>

                    </tr>
                  `
                )
                .join("")
            }

          </tbody>

        </table>

      </div>
    `;
}

/* =========================================================
   MONTHLY + OVERALL
========================================================= */

function analysisHTML(
  rows,
  title,
  growthRows = rows,
  scope = {}
) {
  const coverage =
    teacherCoverage(
      rows,
      scope
    );

  const consistency =
    consistencySummary(
      rows
    );

  const leadership =
    leadershipVisitStats(
      rows
    );

  const gaps =
    weakestCriteria(
      rows
    );

  const strengths =
    strongestCriteria(
      rows
    );

  const scopeText =
    scopeLabel(
      scope.departmentId ||
        "",
      scope.teacherId ||
        ""
    );

  return `
    <article class="panel">

      <h3>
        ${esc(
          title
        )}
      </h3>

      <p class="scope-note">
        نطاق التحليل:
        <strong>
          ${esc(
            scopeText
          )}
        </strong>
      </p>

      <div class="executive-kpi-grid">

        <article class="executive-kpi">
          <span>
            إجمالي الزيارات
          </span>
          <strong>
            ${rows.length}
          </strong>
        </article>

        <article class="executive-kpi">
          <span>
            القيادة العليا
          </span>
          <strong>
            ${leadership.upper}
          </strong>
        </article>

        <article class="executive-kpi">
          <span>
            القيادة الوسطى
          </span>
          <strong>
            ${leadership.middle}
          </strong>
        </article>

        <article class="executive-kpi">
          <span>
            المقيمون المشاركون
          </span>
          <strong>
            ${leadership.evaluators}
          </strong>
        </article>

        <article class="executive-kpi">
          <span>
            التغطية
          </span>
          <strong>
            ${coverage.rate}%
          </strong>
        </article>

        <article class="executive-kpi">
          <span>
            الاتساق
          </span>
          <strong>
            ${consistency.rate}%
          </strong>
        </article>

      </div>

      ${
        coverage.basis ===
        "department-observed"
          ? `
              <div class="analysis-note">
                تُحتسب تغطية القسم من المعلمات اللاتي ظهرت لهن زيارة مسجلة في هذا القسم خلال العام الدراسي؛ لأن سجل المعلمات الأساسي لا يتضمن قسمًا ثابتًا للمعلمة.
              </div>
            `
          : ""
      }

      <div class="dashboard-grid two">

        <div>

          <h4>
            مقارنة الزيارات القيادية
          </h4>

          <div class="analysis-card">

            <strong>
              قيادة عليا:
              ${leadership.upper}
            </strong>

          </div>

          <div class="analysis-card">

            <strong>
              قيادة وسطى:
              ${leadership.middle}
            </strong>

          </div>

        </div>

        <div>

          <h4>
            المقيمون
          </h4>

          ${
            listCards(
              leadership.evaluatorDetails,
              item => `
                <div class="insight-row">

                  <strong>
                    ${esc(
                      item.name
                    )}
                  </strong>

                  <span>
                    ${esc(
                      item.level
                    )}
                    •
                    ${item.count}
                    زيارة
                  </span>

                </div>
              `
            )
          }

        </div>

      </div>

      <div class="dashboard-grid two">

        <div>

          <h4>
            أولويات المتابعة
          </h4>

          ${
            listCards(
              gaps,
              item => `
                <div class="insight-row">

                  <strong>
                    م${item.id}
                    —
                    ${esc(
                      item.criterion_text
                    )}
                  </strong>

                  <span>
                    ${item.inappropriateRate}%
                    يفي بالتوقعات جزئيًا
                  </span>

                </div>
              `
            )
          }

        </div>

        <div>

          <h4>
            جوانب القوة
          </h4>

          ${
            listCards(
              strengths,
              item => `
                <div class="insight-row">

                  <strong>
                    م${item.id}
                    —
                    ${esc(
                      item.criterion_text
                    )}
                  </strong>

                  <span>
                    ${item.exceedsRate}%
                    يتجاوز التوقعات فأعلى
                  </span>

                </div>
              `
            )
          }

        </div>

      </div>

      <div class="criteria-intelligence">

        ${criteriaIntelligenceHTML(
          rows,
          growthRows,
          scopeText
        )}

      </div>

    </article>
  `;
}

function renderMonthly() {
  const month =
    $("monthlyMonth")
      ?.value ||
    availableMonths()[0] ||
    "";

  const rows =
    monthlyScopeRows(
      month
    );

  const growthRows =
    monthlyGrowthRows(
      month
    );

  const label =
    scopeLabel(
      $("monthlyDeptFilter")
        ?.value ||
      "",
      $("monthlyTeacherFilter")
        ?.value ||
      ""
    );

  if (
    $("monthlyContent")
  ) {
    $("monthlyContent").innerHTML =
      analysisHTML(
        rows,
        month
          ? `التحليل الشهري — ${monthLabel(month)} — ${label}`
          : `التحليل الشهري — ${label}`,
        growthRows,
        {
          departmentId:
            $("monthlyDeptFilter")
              ?.value ||
            "",

          teacherId:
            $("monthlyTeacherFilter")
              ?.value ||
            ""
        }
      );
  }
}

function renderOverall() {
  const rows =
    overallFilteredRows();

  const label =
    scopeLabel(
      $("overallDeptFilter")
        ?.value ||
      "",
      $("overallTeacherFilter")
        ?.value ||
      ""
    );

  if (
    $("overallContent")
  ) {
    $("overallContent").innerHTML =
      analysisHTML(
        rows,
        `التحليل الشامل — ${APP_CONFIG.academicYear} — ${label}`,
        rows,
        {
          departmentId:
            $("overallDeptFilter")
              ?.value ||
            "",

          teacherId:
            $("overallTeacherFilter")
              ?.value ||
            ""
        }
      );
  }
}

/* =========================================================
   SUPPORT VIEW
========================================================= */

function renderSupport() {
  const box =
    $("supportContent");

  if (!box) {
    return;
  }

  const teacherFilter =
    $("supportTeacherFilter")
      ?.value ||
    "";

  const statusFilter =
    $("supportStatusFilter")
      ?.value ||
    "";

  const map =
    maps();

  const rows =
    supports.filter(
      support =>
        (
          !teacherFilter ||
          String(
            support.teacher_id
          ) ===
          teacherFilter
        ) &&
        (
          !statusFilter ||
          support.status ===
          statusFilter
        )
    );

  box.innerHTML =
    rows.length
      ? rows
          .map(
            support => {
              const observed =
                supportObservedRow(
                  support
                );

              const criterion =
                criteria.find(
                  item =>
                    num(
                      item.id
                    ) ===
                    num(
                      support.criterion_no
                    )
                );

              return `
                <article
                  class="panel support-card"
                >

                  <div class="panel-head">

                    <div>

                      <h3>
                        ${esc(
                          map.teachers[
                            String(
                              support.teacher_id
                            )
                          ]?.full_name ||
                          "—"
                        )}
                      </h3>

                      <p>
                        م${support.criterion_no}
                        —
                        ${esc(
                          criterion?.criterion_text ||
                          ""
                        )}
                      </p>

                    </div>

                    <span>
                      ${esc(
                        support.status ||
                        "مفتوح"
                      )}
                    </span>

                  </div>


                  <div class="form-grid three">

                    <div>
                      <strong>
                        أسلوب الدعم
                      </strong>
                      <br>
                      ${esc(
                        support.support_type ||
                        "—"
                      )}
                    </div>

                    <div>
                      <strong>
                        تاريخ الدعم
                      </strong>
                      <br>
                      ${formatDate(
                        support.support_date
                      )}
                    </div>

                    <div>
                      <strong>
                        التفاصيل
                      </strong>
                      <br>
                      ${esc(
                        support.support_details ||
                        "—"
                      )}
                    </div>

                  </div>


                  ${
                    observed
                      ? `
                          <div
                            class="analysis-card"
                            style="margin-top:14px"
                          >

                            <strong>
                              المقارنة المرصودة
                            </strong>

                            ${
                              observed.follow &&
                              observed.before &&
                              observed.after

                                ? `
                                    <div class="form-grid three">

                                      <div>

                                        الرصد السابق
                                        <br>

                                        <strong>
                                          ${ratingShort(
                                            observed.before
                                          )}
                                        </strong>

                                        <br>

                                        <small>
                                          ${formatDate(
                                            observed.source.visit_date
                                          )}
                                        </small>

                                      </div>


                                      <div>

                                        الرصد اللاحق
                                        <br>

                                        <strong>
                                          ${ratingShort(
                                            observed.after
                                          )}
                                        </strong>

                                        <br>

                                        <small>
                                          ${formatDate(
                                            observed.follow.visit_date
                                          )}
                                        </small>

                                      </div>


                                      <div>

                                        النتيجة
                                        <br>

                                        <strong>
                                          ${observed.change.label}
                                        </strong>

                                      </div>

                                    </div>
                                  `

                                : `
                                    <p>
                                      لم تُسجل بعد زيارة لاحقة تسمح بالمقارنة على هذا المعيار.
                                    </p>
                                  `
                            }

                          </div>
                        `
                      : ""
                  }

                </article>
              `;
            }
          )
          .join("")

      : `
          <div class="empty-state">
            لا توجد إجراءات دعم مطابقة.
          </div>
        `;
}

/* =========================================================
   REPORTS
========================================================= */

function selectedReportMode() {
  return (
    document.querySelector(
      'input[name="mainReportMode"]:checked'
    )?.value ||
    "monthly"
  );
}

function reportRows() {
  const mode =
    selectedReportMode();

  const departmentId =
    $("reportDeptFilter")
      ?.value ||
    "";

  const teacherId =
    $("reportTeacherFilter")
      ?.value ||
    "";

  if (
    mode ===
    "overall"
  ) {
    return filterVisitsByScope(
      visits,
      {
        departmentId,
        teacherId,
        fromMonth:
          $("reportFromMonth")
            ?.value ||
          "",
        toMonth:
          $("reportToMonth")
            ?.value ||
          ""
      }
    );
  }

  const month =
    $("reportMonth")
      ?.value ||
    availableMonths()[0] ||
    "";

  return filterVisitsByScope(
    visits,
    {
      departmentId,
      teacherId,
      fromMonth:
        month,
      toMonth:
        month
    }
  );
}

function reportGrowthRows() {
  const departmentId =
    $("reportDeptFilter")
      ?.value ||
    "";

  const teacherId =
    $("reportTeacherFilter")
      ?.value ||
    "";

  const mode =
    selectedReportMode();

  if (
    mode ===
    "monthly"
  ) {
    const selectedMonth =
      $("reportMonth")
        ?.value ||
      availableMonths()[0] ||
      "";

    const scoped =
      filterVisitsByScope(
        visits,
        {
          departmentId,
          teacherId
        }
      );

    const months =
      [
        ...new Set(
          scoped
            .map(
              visit =>
                monthKey(
                  visit.visit_date
                )
            )
            .filter(
              Boolean
            )
        )
      ].sort();

    const index =
      months.indexOf(
        selectedMonth
      );

    const wanted =
      index > 0
        ? [
            months[index - 1],
            selectedMonth
          ]
        : [
            selectedMonth
          ];

    return scoped.filter(
      visit =>
        wanted.includes(
          monthKey(
            visit.visit_date
          )
        )
    );
  }

  return filterVisitsByScope(
    visits,
    {
      departmentId,
      teacherId,

      fromMonth:
        $("reportFromMonth")
          ?.value ||
        "",

      toMonth:
        $("reportToMonth")
          ?.value ||
        ""
    }
  );
}

function generateReport() {
  const box =
    $("reportOutput");

  if (!box) {
    return;
  }

  const rows =
    reportRows();

  const growthRows =
    reportGrowthRows();

  const mode =
    selectedReportMode();

  const departmentId =
    $("reportDeptFilter")
      ?.value ||
    "";

  const teacherId =
    $("reportTeacherFilter")
      ?.value ||
    "";

  const reportScope =
    scopeLabel(
      departmentId,
      teacherId
    );

  const period =
    mode ===
      "overall"
      ? APP_CONFIG.academicYear
      : monthLabel(
          $("reportMonth")
            ?.value ||
          availableMonths()[0] ||
          ""
        );

  const leadership =
    leadershipVisitStats(
      rows
    );

  const coverage =
    teacherCoverage(
      rows,
      {
        departmentId,
        teacherId
      }
    );

  const gaps =
    weakestCriteria(
      rows
    );

  box.innerHTML =
    `
      <div class="official-report">

        <img
          src="${SCHOOL_HEADER_IMAGE}"
          style="
            max-width:100%;
            margin-bottom:18px;
          "
          alt="الترويسة الرسمية"
        >

        <h2>
          تقرير الزيارات الصفية
        </h2>

        <p>
          ${esc(
            period
          )}
          —
          ${esc(
            reportScope
          )}
        </p>

        <h3>
          الملخص التنفيذي
        </h3>

        <p id="officialExecutiveSummary">
          بلغ إجمالي الزيارات
          <strong>
            ${rows.length}
          </strong>
          زيارة،
          منها
          <strong>
            ${leadership.upper}
          </strong>
          للقيادة العليا
          و
          <strong>
            ${leadership.middle}
          </strong>
          للقيادة الوسطى.
          وبلغت التغطية الرصدية
          <strong>
            ${coverage.rate}%
          </strong>.
        </p>

        <h3>
          أبرز الأولويات
        </h3>

        ${
          gaps.length
            ? `
                <ul>

                  ${
                    gaps
                      .map(
                        item => `
                          <li>
                            المعيار
                            م${item.id}:
                            ${esc(
                              item.criterion_text
                            )}
                            —
                            يفي بالتوقعات جزئيًا
                            ${item.inappropriateRate}%
                          </li>
                        `
                      )
                      .join("")
                  }

                </ul>
              `
            : `
                <p>
                  لا توجد بيانات كافية لتحديد أولوية.
                </p>
              `
        }

        <h3>
          تحليل المعايير والنمو
        </h3>

        ${criteriaIntelligenceHTML(
          rows,
          growthRows,
          reportScope
        )}

        <h3>
          التوصيات
        </h3>

        <p id="officialRecommendations">
          توجيه الدعم المهني نحو المعايير الأكثر تكرارًا في الحاجة إلى التطوير،
          ومتابعة التغير المرصود في الزيارات اللاحقة،
          مع مراعاة حجم العينة وعدم تعميم النتائج خارج نطاق البيانات المتاحة.
        </p>

        <div
          class="report-signatures"
          style="
            display:grid;
            grid-template-columns:repeat(3,1fr);
            gap:20px;
            margin-top:34px;
            padding-top:18px;
            border-top:2px solid #0d5f66;
            text-align:center;
          "
        >

          <div>
            <span>
              معدّة التقرير
            </span>
            <br>
            <strong>
              ${REPORT_INFO.preparedBy}
            </strong>
          </div>

          <div>
            <span>
              المديرة المساعدة
            </span>
            <br>
            <strong>
              ${REPORT_INFO.assistantPrincipal}
            </strong>
          </div>

          <div>
            <span>
              مديرة المدرسة
            </span>
            <br>
            <strong>
              ${REPORT_INFO.principal}
            </strong>
          </div>

        </div>

      </div>
    `;
}

function localReportNarrative(rows) {
  const departmentId = $("reportDeptFilter")?.value || "";
  const teacherId = $("reportTeacherFilter")?.value || "";
  const scope = scopeLabel(departmentId, teacherId);
  const leadership = leadershipVisitStats(rows);
  const coverage = teacherCoverage(rows, { departmentId, teacherId });
  const gaps = weakestCriteria(rows).slice(0, 3);
  const strengths = strongestCriteria(rows).slice(0, 3);

  const summaryParts = [
    `يعرض التقرير نتائج ${rows.length} زيارة صفية ضمن نطاق ${scope}.`,
    `بلغت التغطية الرصدية ${coverage.rate}%، مع ${leadership.upper} زيارة للقيادة العليا و${leadership.middle} زيارة للقيادة الوسطى.`
  ];

  if (strengths.length) {
    summaryParts.push(
      `وتشير البيانات المرصودة إلى قوة نسبية في ${strengths.map(item => `المعيار م${item.id} (${item.criterion_text})`).join("، ")}.`
    );
  }

  if (gaps.length) {
    summaryParts.push(
      `وتتركز أولويات المتابعة في ${gaps.map(item => `المعيار م${item.id} (${item.criterion_text})`).join("، ")}.`
    );
  } else {
    summaryParts.push("ولا تتوافر حاليًا بيانات كافية لتحديد أولويات تفصيلية على مستوى المعايير.");
  }

  const recommendations = gaps.length
    ? `يوصى بتوجيه المتابعة المهنية نحو ${gaps.map(item => `م${item.id}`).join("، ")}، ومراجعة التغير المرصود في الزيارات اللاحقة، مع ربط الدعم باحتياجات القسم أو المعلمة وفق نطاق التقرير، ومراعاة حجم العينة قبل تعميم النتائج.`
    : "يوصى باستمرار الرصد المنتظم واستكمال حجم العينة، ثم تحديد أولويات الدعم المهني في ضوء النتائج المتراكمة للزيارات اللاحقة.";

  return {
    summary: summaryParts.join(" "),
    recommendations
  };
}

function ensureNarrativeEditor() {
  let editor = $("reportNarrativeEditor");
  if (editor) return editor;

  const output = $("reportOutput");
  if (!output) return null;

  editor = document.createElement("section");
  editor.id = "reportNarrativeEditor";
  editor.className = "panel";
  editor.style.marginBottom = "18px";
  editor.innerHTML = `
    <h3>تحرير صياغة التقرير</h3>
    <p class="muted">يمكنك تعديل النص أو الإضافة عليه قبل اعتماده في التقرير والطباعة.</p>
    <label style="display:block;margin:14px 0 6px;font-weight:700;">الملخص التنفيذي</label>
    <textarea id="narrativeSummaryEditor" rows="7" style="width:100%;min-height:150px;resize:vertical;"></textarea>
    <label style="display:block;margin:14px 0 6px;font-weight:700;">التوصيات</label>
    <textarea id="narrativeRecommendationsEditor" rows="6" style="width:100%;min-height:130px;resize:vertical;"></textarea>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
      <button type="button" class="btn btn-primary" id="applyNarrativeEdits">اعتماد التعديلات في التقرير</button>
      <button type="button" class="btn btn-soft" id="restoreNarrativeDraft">استعادة آخر صياغة</button>
    </div>
    <div id="narrativeEditorStatus" class="muted" style="margin-top:8px;"></div>
  `;
  output.parentNode.insertBefore(editor, output);

  $("applyNarrativeEdits")?.addEventListener("click", applyNarrativeEdits);
  $("restoreNarrativeDraft")?.addEventListener("click", () => {
    if ($("narrativeSummaryEditor")) $("narrativeSummaryEditor").value = reportNarrativeDraft.summary || "";
    if ($("narrativeRecommendationsEditor")) $("narrativeRecommendationsEditor").value = reportNarrativeDraft.recommendations || "";
  });

  return editor;
}

function applyNarrativeEdits() {
  const summary = $("narrativeSummaryEditor")?.value?.trim() || "";
  const recommendations = $("narrativeRecommendationsEditor")?.value?.trim() || "";

  reportNarrativeDraft = { summary, recommendations };

  const summaryTarget = $("officialExecutiveSummary");
  const recommendationsTarget = $("officialRecommendations");

  if (!summaryTarget || !recommendationsTarget) {
    generateReport();
  }

  const freshSummaryTarget = $("officialExecutiveSummary");
  const freshRecommendationsTarget = $("officialRecommendations");
  if (freshSummaryTarget) freshSummaryTarget.textContent = summary;
  if (freshRecommendationsTarget) freshRecommendationsTarget.textContent = recommendations;

  const editorStatus = $("narrativeEditorStatus");
  if (editorStatus) editorStatus.textContent = "تم اعتماد النص المعدل داخل التقرير، وستظهر هذه النسخة في الطباعة / PDF.";
}

async function generateNarrative() {
  const status = $("narrativeStatus");
  const rows = reportRows();

  if (!$("reportOutput")?.innerHTML.trim()) {
    generateReport();
  }

  ensureNarrativeEditor();

  try {
    if (status) status.textContent = "جاري إعداد الصياغة...";

    const { data, error } = await sb.functions.invoke(
      "generate-report-narrative",
      {
        body: {
          academicYear: APP_CONFIG.academicYear,
          visitsCount: rows.length,
          gaps: weakestCriteria(rows).map(item => ({
            criterion: item.id,
            text: item.criterion_text,
            rate: item.inappropriateRate
          }))
        }
      }
    );

    if (error) throw error;

    const fallback = localReportNarrative(rows);
    reportNarrativeDraft = {
      summary: String(data?.summary || fallback.summary).trim(),
      recommendations: String(data?.recommendations || fallback.recommendations).trim()
    };

    if ($("narrativeSummaryEditor")) $("narrativeSummaryEditor").value = reportNarrativeDraft.summary;
    if ($("narrativeRecommendationsEditor")) $("narrativeRecommendationsEditor").value = reportNarrativeDraft.recommendations;
    applyNarrativeEdits();

    if (status) status.textContent = "تم إعداد الصياغة. يمكنك تعديلها ثم اعتماد التعديلات.";
  } catch (error) {
    console.error(error);

    reportNarrativeDraft = localReportNarrative(rows);
    if ($("narrativeSummaryEditor")) $("narrativeSummaryEditor").value = reportNarrativeDraft.summary;
    if ($("narrativeRecommendationsEditor")) $("narrativeRecommendationsEditor").value = reportNarrativeDraft.recommendations;
    applyNarrativeEdits();

    if (status) status.textContent = "تم إعداد صياغة محلية من بيانات التقرير. يمكنك تعديلها واعتمادها.";
  }
}

/* =========================================================
   FORM HELPERS
========================================================= */

function clearForm() {
  editingVisitId =
    null;

  $("visitForm")
    ?.reset();

  document
    .querySelectorAll(
      'input[name^="criterion_"]'
    )
    .forEach(
      item =>
        item.checked =
          false
    );

  document
    .querySelectorAll(
      ".support-criterion-check"
    )
    .forEach(
      item =>
        item.checked =
          false
    );

  criteria.forEach(
    criterion => {
      const note =
        $(
          `criterionNote_${criterion.id}`
        );

      if (
        note
      ) {
        note.value =
          "";
      }
    }
  );

  if (
    $("visitDate")
  ) {
    $("visitDate").value =
      new Date()
        .toISOString()
        .slice(
          0,
          10
        );
  }

  if (
    currentProfile?.role ===
      "admin" &&
    $("visitObserverSelect")
  ) {
    $("visitObserverSelect").value =
      "";
  }

  updateSubjectSelect();

  updateEvaluatorBlock();

  updateConsistencyHint();
}

async function upsertSingle(
  table,
  visitId,
  payload
) {
  const {
    error
  } =
    await sb
      .from(
        table
      )
      .upsert(
        {
          visit_id:
            visitId,

          ...payload
        },
        {
          onConflict:
            "visit_id"
        }
      );

  if (
    error
  ) {
    throw error;
  }
}

/* =========================================================
   SAVE VISIT
========================================================= */

async function saveVisit(
  event
) {
  event.preventDefault();

  const message =
    $("saveMsg");

  try {
    const ratingsMap =
      collectCriterionRatings();

    const missing =
      criteria.filter(
        criterion =>
          !ratingsMap[
            num(
              criterion.id
            )
          ]
      );

    if (
      missing.length
    ) {
      throw new Error(
        "استكملي تقييم المعايير الثمانية عشر."
      );
    }

    const base =
      Math.min(
        num(
          ratingsMap[1]
        ),
        num(
          ratingsMap[2]
        )
      );

    if (
      num(
        ratingsMap[9]
      ) !==
        base ||
      num(
        ratingsMap[10]
      ) !==
        base
    ) {
      throw new Error(
        "المعياران 9 و10 يجب أن يساويا الأقل بين المعيارين 1 و2."
      );
    }

    const observer =
      selectedObserverProfile();

    if (
      currentProfile?.role ===
        "admin" &&
      !$("visitObserverSelect")
        ?.value
    ) {
      throw new Error(
        "اختاري منفذ الزيارة الفعلي."
      );
    }

    const payload = {
      visit_date:
        $("visitDate").value,

      academic_year:
        APP_CONFIG.academicYear,

      teacher_id:
        num(
          $("teacherSelect")
            .value
        ),

      department_id:
        num(
          $("departmentSelect")
            .value
        ),

      subject_id:
        num(
          $("subjectSelect")
            .value
        ),

      observer_id:
        observer.id,

      visit_number:
        $("visitNumber")
          .value
          ? num(
              $("visitNumber")
                .value
            )
          : null,

      grade_section:
        $("gradeSection")
          .value ||
        null,

      period_name:
        $("periodName")
          .value ||
        null,

      lesson_title:
        $("lessonTitle")
          .value ||
        null,

      students_count:
        $("studentsCount")
          .value
          ? num(
              $("studentsCount")
                .value
            )
          : null,

      absent_count:
        $("absentCount")
          .value
          ? num(
              $("absentCount")
                .value
            )
          : null,

      overall_rating:
        num(
          $("overallRating")
            .value
        ),

      general_notes:
        $("generalNotes")
          .value ||
        null
    };

    if (
      !payload.teacher_id ||
      !payload.department_id ||
      !payload.subject_id ||
      !payload.visit_date ||
      !payload.overall_rating
    ) {
      throw new Error(
        "استكملي بيانات الزيارة الأساسية."
      );
    }

    const consistency =
      consistencyForRatings(
        ratingsMap,
        payload.overall_rating
      );

    if (
      !consistency.consistent
    ) {
      throw new Error(
        consistency.messages.join(
          "\n"
        )
      );
    }

    let visitId =
      editingVisitId;

    if (
      editingVisitId
    ) {
      const {
        error
      } =
        await sb
          .from(
            "visits"
          )
          .update(
            payload
          )
          .eq(
            "id",
            editingVisitId
          );

      if (
        error
      ) {
        throw error;
      }
    }
    else {
      const {
        data,
        error
      } =
        await sb
          .from(
            "visits"
          )
          .insert(
            payload
          )
          .select(
            "id"
          )
          .single();

      if (
        error
      ) {
        throw error;
      }

      visitId =
        data.id;
    }

    await sb
      .from(
        "visit_criteria"
      )
      .delete()
      .eq(
        "visit_id",
        visitId
      );

    const criteriaRows =
      criteria.map(
        criterion => ({
          visit_id:
            visitId,

          criterion_no:
            num(
              criterion.id
            ),

          rating:
            num(
              ratingsMap[
                num(
                  criterion.id
                )
              ]
            ),

          note:
            $(
              `criterionNote_${criterion.id}`
            )?.value ||
            null
        })
      );

    const criteriaResponse =
      await sb
        .from(
          "visit_criteria"
        )
        .insert(
          criteriaRows
        );

    if (
      criteriaResponse.error
    ) {
      throw criteriaResponse.error;
    }

    await upsertSingle(
      "visit_feedback",
      visitId,
      {
        strengths:
          $("strengths")
            .value ||
          null,

        development_areas:
          $("developmentAreas")
            .value ||
          null
      }
    );

    await upsertSingle(
      "visit_skills",
      visitId,
      {
        critical_thinking:
          $("skill1").checked,

        collaboration_communication:
          $("skill2").checked,

        creativity_innovation:
          $("skill3").checked,

        information_literacy:
          $("skill4").checked,

        digital_literacy:
          $("skill5").checked,

        global_cultural_awareness:
          $("skill6").checked,

        adaptability_flexibility:
          $("skill7").checked,

        emotional_intelligence:
          $("skill8").checked
      }
    );

    await upsertSingle(
      "student_work_followup",
      visitId,
      {
        samples_count:
          $("samplesCount")
            .value
            ? num(
                $("samplesCount")
                  .value
              )
            : null,

        activities_alignment:
          $("sw1").checked,

        differentiated_levels:
          $("sw2").checked,

        higher_thinking_research_selflearning:
          $("sw3").checked,

        regular_correction:
          $("sw4").checked,

        constructive_feedback:
          $("sw5").checked,

        notes:
          $("studentWorkNotes")
            .value ||
          null
      }
    );

    /*
      عند تعديل زيارة قديمة:
      نحذف دعم نفس الزيارة
      ونبنيه من جديد حسب الاختيارات.
    */

    if (
      editingVisitId
    ) {
      const oldSupports =
        supports.filter(
          support =>
            String(
              support.source_visit_id
            ) ===
            String(
              visitId
            )
        );

      for (
        const support of oldSupports
      ) {
        await sb
          .from(
            "support_followups"
          )
          .delete()
          .eq(
            "support_action_id",
            support.id
          );
      }

      await sb
        .from(
          "support_actions"
        )
        .delete()
        .eq(
          "source_visit_id",
          visitId
        );
    }

    const supportType =
      $("supportType")
        .value;

    const selectedCriteria =
      selectedSupportCriteria();

    if (
      supportType
    ) {
      if (
        !selectedCriteria.length
      ) {
        throw new Error(
          "اختاري معيارًا واحدًا على الأقل للدعم."
        );
      }

      const supportRows =
        selectedCriteria.map(
          criterionNo => ({
            teacher_id:
              payload.teacher_id,

            source_visit_id:
              visitId,

            criterion_no:
              criterionNo,

            support_type:
              supportType,

            support_details:
              $("supportDetails")
                .value ||
              null,

            support_date:
              payload.visit_date,

            status:
              "مفتوح",

            created_by:
              currentProfile.id
          })
        );

      const response =
        await sb
          .from(
            "support_actions"
          )
          .insert(
            supportRows
          );

      if (
        response.error
      ) {
        throw response.error;
      }
    }

    /*
      تحميل البيانات أولًا حتى تدخل الزيارة الجديدة
      ضمن المقارنة.
    */

    await loadAll();

    /*
      إنشاء متابعة تلقائية لأي دعم سابق
      لنفس المعلمة.
    */

    await createAutomaticFollowupsForVisit(
      visitId
    );

    await loadAll();

    fillUI();

    renderAll();

    if (
      message
    ) {
      message.className =
        "message success";

      message.textContent =
        "تم حفظ الزيارة بنجاح.";
    }

    clearForm();

    showView(
      "history"
    );
  }
  catch (
    error
  ) {
    console.error(
      error
    );

    if (
      message
    ) {
      message.className =
        "message danger";

      message.textContent =
        error.message ||
        "تعذر حفظ الزيارة.";
    }
  }
}

/* =========================================================
   AUTO SUPPORT FOLLOWUP
========================================================= */

async function createAutomaticFollowupsForVisit(
  visitId
) {
  const visit =
    visits.find(
      item =>
        String(
          item.id
        ) ===
        String(
          visitId
        )
    );

  if (!visit) {
    return;
  }

  const currentRatings =
    ratingMapForVisit(
      visitId
    );

  const candidates =
    supports.filter(
      support =>
        String(
          support.teacher_id
        ) ===
          String(
            visit.teacher_id
          ) &&
        String(
          support.source_visit_id
        ) !==
          String(
            visitId
          )
    );

  for (
    const support of candidates
  ) {
    const source =
      visits.find(
        item =>
          String(
            item.id
          ) ===
          String(
            support.source_visit_id
          )
      );

    if (
      !source ||
      String(
        source.visit_date
      ) >
      String(
        visit.visit_date
      )
    ) {
      continue;
    }

    const before =
      ratingMapForVisit(
        source.id
      )[
        num(
          support.criterion_no
        )
      ];

    const after =
      currentRatings[
        num(
          support.criterion_no
        )
      ];

    if (
      !before ||
      !after
    ) {
      continue;
    }

    const existing =
      supportFollowups.find(
        followup =>
          String(
            followup.support_action_id
          ) ===
            String(
              support.id
            ) &&
          String(
            followup.followup_visit_id
          ) ===
            String(
              visitId
            )
      );

    const change =
      changeInfo(
        before,
        after
      );

    const assessment =
      change.label ===
        "تحسن"
        ? "أثر واضح"
        : change.label ===
            "استقرار"
          ? "لم يظهر أثر بعد"
          : "يحتاج متابعة إضافية";

    const payload = {
      support_action_id:
        support.id,

      followup_visit_id:
        visitId,

      before_rating:
        before,

      after_rating:
        after,

      leadership_assessment:
        assessment,

      followup_note:
        `التغير المرصود: ${change.label}`
    };

    if (
      existing
    ) {
      await sb
        .from(
          "support_followups"
        )
        .update(
          payload
        )
        .eq(
          "id",
          existing.id
        );
    }
    else {
      await sb
        .from(
          "support_followups"
        )
        .insert(
          payload
        );
    }

    await sb
      .from(
        "support_actions"
      )
      .update(
        {
          status:
            "تحت المتابعة"
        }
      )
      .eq(
        "id",
        support.id
      );
  }
}

/* =========================================================
   VIEW VISIT
========================================================= */

window.viewVisit =
  function (
    id
  ) {
    const visit =
      visits.find(
        item =>
          String(
            item.id
          ) ===
          String(
            id
          )
      );

    if (!visit) {
      return;
    }

    const map =
      maps();

    const ratingsMap =
      ratingMapForVisit(
        id
      );

    $("modalRoot").innerHTML =
      `
        <div
          class="modal-backdrop"
          onclick="
            if(event.target===this)
              this.remove()
          "
        >

          <div class="modal">

            <div class="modal-head">

              <h3>
                تفاصيل الزيارة
              </h3>

              <button
                onclick="
                  this.closest('.modal-backdrop').remove()
                "
              >
                ×
              </button>

            </div>


            <p>
              <strong>
                المعلمة:
              </strong>

              ${esc(
                map.teachers[
                  String(
                    visit.teacher_id
                  )
                ]?.full_name ||
                "—"
              )}
            </p>


            <p>
              <strong>
                المقيم:
              </strong>

              ${esc(
                evaluatorName(
                  visit
                )
              )}
              —
              ${esc(
                evaluatorLevel(
                  visit
                )
              )}
            </p>


            <p>
              <strong>
                التاريخ:
              </strong>

              ${formatDate(
                visit.visit_date
              )}
            </p>


            <p>
              <strong>
                الحكم:
              </strong>

              ${ratingLabel(
                visit.overall_rating
              )}
            </p>


            <div class="table-wrap">

              <table>

                <thead>

                  <tr>
                    <th>المعيار</th>
                    <th>الرصد</th>
                  </tr>

                </thead>

                <tbody>

                  ${
                    criteria
                      .map(
                        criterion => `
                          <tr>

                            <td>
                              م${criterion.id}
                              —
                              ${esc(
                                criterion.criterion_text
                              )}
                            </td>

                            <td>
                              ${ratingShort(
                                ratingsMap[
                                  num(
                                    criterion.id
                                  )
                                ]
                              )}
                            </td>

                          </tr>
                        `
                      )
                      .join("")
                  }

                </tbody>

              </table>

            </div>

          </div>

        </div>
      `;
  };

/* =========================================================
   EDIT VISIT
========================================================= */

window.editVisit =
  function (
    id
  ) {
    const visit =
      visits.find(
        item =>
          String(
            item.id
          ) ===
          String(
            id
          )
      );

    if (!visit) {
      return;
    }

    editingVisitId =
      id;

    $("teacherSelect").value =
      visit.teacher_id;

    $("departmentSelect").value =
      visit.department_id;

    updateSubjectSelect(
      visit.subject_id
    );

    $("visitDate").value =
      visit.visit_date;

    $("visitNumber").value =
      visit.visit_number ||
      "";

    $("gradeSection").value =
      visit.grade_section ||
      "";

    $("periodName").value =
      visit.period_name ||
      "";

    $("lessonTitle").value =
      visit.lesson_title ||
      "";

    $("studentsCount").value =
      visit.students_count ||
      "";

    $("absentCount").value =
      visit.absent_count ||
      "";

    $("overallRating").value =
      visit.overall_rating ||
      "";

    $("generalNotes").value =
      visit.general_notes ||
      "";

    if (
      currentProfile?.role ===
        "admin" &&
      $("visitObserverSelect")
    ) {
      $("visitObserverSelect").value =
        visit.observer_id ||
        "";
    }

    const ratingsMap =
      ratingMapForVisit(
        id
      );

    criteria.forEach(
      criterion => {
        const radio =
          document.querySelector(
            `input[name="criterion_${criterion.id}"][value="${ratingsMap[num(criterion.id)]}"]`
          );

        if (
          radio
        ) {
          radio.checked =
            true;
        }

        const ratingRow =
          ratingsForVisit(
            id
          )
            .find(
              item =>
                num(
                  item.criterion_no
                ) ===
                num(
                  criterion.id
                )
            );

        const note =
          $(
            `criterionNote_${criterion.id}`
          );

        if (
          note
        ) {
          note.value =
            ratingRow?.note ||
            "";
        }
      }
    );

    const feedbackRow =
      feedback.find(
        item =>
          String(
            item.visit_id
          ) ===
          String(
            id
          )
      );

    $("strengths").value =
      feedbackRow?.strengths ||
      "";

    $("developmentAreas").value =
      feedbackRow?.development_areas ||
      "";

    const skillRow =
      visitSkills.find(
        item =>
          String(
            item.visit_id
          ) ===
          String(
            id
          )
      );

    SKILLS.forEach(
      (
        [
          key
        ],
        index
      ) => {
        const checkbox =
          $(
            `skill${index + 1}`
          );

        if (
          checkbox
        ) {
          checkbox.checked =
            !!skillRow?.[
              key
            ];
        }
      }
    );

    const workRow =
      studentWork.find(
        item =>
          String(
            item.visit_id
          ) ===
          String(
            id
          )
      );

    if (
      $("samplesCount")
    ) {
      $("samplesCount").value =
        workRow?.samples_count ||
        "";
    }

    WORK_ITEMS.forEach(
      (
        [
          key
        ],
        index
      ) => {
        const checkbox =
          $(
            `sw${index + 1}`
          );

        if (
          checkbox
        ) {
          checkbox.checked =
            !!workRow?.[
              key
            ];
        }
      }
    );

    if (
      $("studentWorkNotes")
    ) {
      $("studentWorkNotes").value =
        workRow?.notes ||
        "";
    }

    document
      .querySelectorAll(
        ".support-criterion-check"
      )
      .forEach(
        item =>
          item.checked =
            false
      );

    const supportRows =
      supports.filter(
        item =>
          String(
            item.source_visit_id
          ) ===
          String(
            id
          )
      );

    if (
      supportRows.length
    ) {
      $("supportType").value =
        supportRows[0]
          .support_type ||
        "";

      $("supportDetails").value =
        supportRows[0]
          .support_details ||
        "";

      supportRows.forEach(
        support => {
          const checkbox =
            document.querySelector(
              `.support-criterion-check[value="${support.criterion_no}"]`
            );

          if (
            checkbox
          ) {
            checkbox.checked =
              true;
          }
        }
      );
    }
    else {
      $("supportType").value =
        "";

      $("supportDetails").value =
        "";
    }

    updateEvaluatorBlock();

    updateConsistencyHint();

    showView(
      "newVisit"
    );
  };

/* =========================================================
   DELETE VISIT
========================================================= */

window.deleteVisit =
  async function (
    id
  ) {
    if (
      currentProfile?.role !==
      "admin"
    ) {
      return;
    }

    if (
      !confirm(
        "هل أنتِ متأكدة من حذف الزيارة؟"
      )
    ) {
      return;
    }

    const {
      error
    } =
      await sb.rpc(
        "admin_delete_visit",
        {
          p_visit_id:
            id
        }
      );

    if (
      error
    ) {
      alert(
        error.message
      );

      return;
    }

    await loadAll();

    fillUI();

    renderAll();
  };

/* =========================================================
   PRINT VISIT
========================================================= */

window.printVisitForm =
  function (
    id
  ) {
    const visit =
      visits.find(
        item =>
          String(
            item.id
          ) ===
          String(
            id
          )
      );

    if (!visit) {
      return;
    }

    const map =
      maps();

    const teacher =
      map.teachers[
        String(
          visit.teacher_id
        )
      ];

    const department =
      map.departments[
        String(
          visit.department_id
        )
      ];

    const subject =
      map.subjects[
        String(
          visit.subject_id
        )
      ];

    const ratingsMap =
      ratingMapForVisit(
        id
      );

    const feedbackRow =
      feedback.find(
        item =>
          String(
            item.visit_id
          ) ===
          String(
            id
          )
      );

    const skillRow =
      visitSkills.find(
        item =>
          String(
            item.visit_id
          ) ===
          String(
            id
          )
      );

    const workRow =
      studentWork.find(
        item =>
          String(
            item.visit_id
          ) ===
          String(
            id
          )
      );

    const groupedDomains =
      [
        ...new Set(
          criteria.map(
            criterion =>
              criterion.domain_name
          )
        )
      ];

    const criteriaHTML =
      groupedDomains
        .map(
          domain => `
            <tr class="domain-title">
              <td colspan="6">
                ${esc(
                  domain
                )}
              </td>
            </tr>

            ${
              criteria
                .filter(
                  criterion =>
                    criterion.domain_name ===
                    domain
                )
                .map(
                  criterion => {
                    const value =
                      num(
                        ratingsMap[
                          num(
                            criterion.id
                          )
                        ]
                      );

                    const mark =
                      level =>
                        value ===
                        level
                          ? "✓"
                          : "";

                    return `
                      <tr>
                        <td class="criterion-text">
                          <strong>
                            م${criterion.id}
                          </strong>
                          —
                          ${esc(
                            criterion.criterion_text
                          )}
                          ${
                            criterion.is_evaluation_key
                              ? `
                                  <span class="key-badge">
                                    مفتاح تقييم
                                  </span>
                                `
                              : ""
                          }
                        </td>

                        <td class="rating-cell level-1">
                          ${mark(1)}
                        </td>

                        <td class="rating-cell level-2">
                          ${mark(2)}
                        </td>

                        <td class="rating-cell level-3">
                          ${mark(3)}
                        </td>

                        <td class="rating-cell level-4">
                          ${mark(4)}
                        </td>

                        <td class="note-cell">
                          ${esc(
                            ratingsForVisit(
                              id
                            ).find(
                              row =>
                                num(
                                  row.criterion_no
                                ) ===
                                num(
                                  criterion.id
                                )
                            )?.note ||
                            ""
                          )}
                        </td>
                      </tr>
                    `;
                  }
                )
                .join("")
            }
          `
        )
        .join("");

    const printWindow =
      window.open(
        "",
        "_blank"
      );

    if (!printWindow) {
      alert(
        "يرجى السماح بالنوافذ المنبثقة حتى يمكن طباعة الاستمارة."
      );

      return;
    }

    printWindow.document.write(
      `
        <!doctype html>

        <html
          lang="ar"
          dir="rtl"
        >

          <head>

            <meta charset="utf-8">

            <meta
              name="viewport"
              content="width=device-width,initial-scale=1"
            >

            <title>
              استمارة الملاحظة الصفية الموحدة
            </title>

            <style>

              * {
                box-sizing:
                  border-box;
              }

              body {
                margin:
                  0;
                padding:
                  10mm;
                font-family:
                  Tahoma,
                  Arial,
                  sans-serif;
                color:
                  #163a3e;
                background:
                  #fff;
                font-size:
                  11px;
                line-height:
                  1.55;
              }

              .sheet {
                width:
                  100%;
                margin:
                  0 auto;
              }

              .school-header {
                text-align:
                  center;
                margin-bottom:
                  8px;
              }

              .school-header img {
                max-width:
                  100%;
                max-height:
                  95px;
                object-fit:
                  contain;
              }

              .title {
                text-align:
                  center;
                margin:
                  5px 0 10px;
              }

              .title h1 {
                margin:
                  0;
                color:
                  #0d5f66;
                font-size:
                  19px;
              }

              .title p {
                margin:
                  3px 0 0;
                color:
                  #526b6e;
              }

              .info-grid {
                display:
                  grid;
                grid-template-columns:
                  repeat(4,1fr);
                border:
                  1px solid #9db8ba;
                border-bottom:
                  0;
              }

              .info-item {
                min-height:
                  42px;
                border-left:
                  1px solid #9db8ba;
                border-bottom:
                  1px solid #9db8ba;
                padding:
                  5px 7px;
              }

              .info-item:nth-child(4n) {
                border-left:
                  0;
              }

              .info-label {
                display:
                  block;
                color:
                  #5c7477;
                font-size:
                  9px;
                margin-bottom:
                  2px;
              }

              .info-value {
                font-weight:
                  700;
                color:
                  #163a3e;
              }

              .overall-box {
                margin:
                  8px 0;
                border:
                  2px solid #0d5f66;
                background:
                  #eef6f6;
                padding:
                  7px 10px;
                display:
                  flex;
                justify-content:
                  space-between;
                align-items:
                  center;
                gap:
                  10px;
              }

              .overall-box strong {
                font-size:
                  13px;
              }

              table {
                width:
                  100%;
                border-collapse:
                  collapse;
                table-layout:
                  fixed;
              }

              th,
              td {
                border:
                  1px solid #9db8ba;
                padding:
                  4px;
                vertical-align:
                  middle;
              }

              thead th {
                background:
                  #0d5f66;
                color:
                  #fff;
                font-size:
                  9px;
                text-align:
                  center;
              }

              .criterion-text {
                width:
                  39%;
                text-align:
                  right;
              }

              .rating-head {
                width:
                  9%;
              }

              .note-head,
              .note-cell {
                width:
                  25%;
              }

              .rating-cell {
                text-align:
                  center;
                font-size:
                  15px;
                font-weight:
                  900;
              }

              .level-1 {
                background:
                  #faecec;
              }

              .level-2 {
                background:
                  #fbf2df;
              }

              .level-3 {
                background:
                  #e8f3ed;
              }

              .level-4 {
                background:
                  #dceeed;
              }

              .domain-title td {
                background:
                  #dcebec;
                color:
                  #0d5f66;
                font-weight:
                  800;
                padding:
                  5px 7px;
              }

              .key-badge {
                display:
                  inline-block;
                margin-right:
                  4px;
                padding:
                  1px 5px;
                border-radius:
                  8px;
                background:
                  #f2e4bd;
                color:
                  #76581b;
                font-size:
                  8px;
              }

              .section {
                margin-top:
                  9px;
                border:
                  1px solid #9db8ba;
                break-inside:
                  avoid;
              }

              .section-title {
                padding:
                  5px 8px;
                background:
                  #eaf3f3;
                color:
                  #0d5f66;
                font-weight:
                  800;
              }

              .section-body {
                padding:
                  7px 9px;
              }

              .check-grid {
                display:
                  grid;
                grid-template-columns:
                  repeat(2,1fr);
                gap:
                  4px 12px;
              }

              .check-item {
                border-bottom:
                  1px dotted #b9c9ca;
                padding:
                  3px 0;
              }

              .yes {
                font-weight:
                  800;
                color:
                  #0d5f66;
              }

              .feedback-grid {
                display:
                  grid;
                grid-template-columns:
                  1fr 1fr;
                gap:
                  8px;
              }

              .feedback-box {
                min-height:
                  68px;
                border:
                  1px solid #c1d0d1;
                padding:
                  7px;
              }

              .feedback-box strong {
                display:
                  block;
                color:
                  #0d5f66;
                margin-bottom:
                  4px;
              }

              .teacher-approval {
                margin-top:
                  12px;
                border:
                  2px solid #0d5f66;
                padding:
                  10px;
                break-inside:
                  avoid;
              }

              .teacher-approval h3 {
                margin:
                  0 0 8px;
                color:
                  #0d5f66;
                font-size:
                  13px;
              }

              .approval-grid {
                display:
                  grid;
                grid-template-columns:
                  2fr 1fr 1fr;
                gap:
                  12px;
              }

              .signature-line {
                border-bottom:
                  1px solid #6d7f81;
                min-height:
                  24px;
                padding-bottom:
                  3px;
              }

              .management-signatures {
                margin-top:
                  14px;
                padding-top:
                  10px;
                border-top:
                  2px solid #0d5f66;
                display:
                  grid;
                grid-template-columns:
                  repeat(3,1fr);
                gap:
                  14px;
                text-align:
                  center;
                break-inside:
                  avoid;
              }

              .management-signatures span {
                display:
                  block;
                color:
                  #61787b;
                font-size:
                  9px;
                margin-bottom:
                  3px;
              }

              .management-signatures strong {
                font-size:
                  11px;
              }

              .print-btn {
                margin-top:
                  12px;
                padding:
                  8px 18px;
                border:
                  0;
                border-radius:
                  7px;
                background:
                  #0d5f66;
                color:
                  #fff;
                cursor:
                  pointer;
              }

              @page {
                size:
                  A4 portrait;
                margin:
                  8mm;
              }

              @media print {

                body {
                  padding:
                    0;
                }

                .print-btn {
                  display:
                    none;
                }

                thead {
                  display:
                    table-header-group;
                }

                tr,
                .section,
                .teacher-approval,
                .management-signatures {
                  break-inside:
                    avoid;
                }

              }

            </style>

          </head>

          <body>

            <div class="sheet">

              <div class="school-header">
                <img
                  src="${SCHOOL_HEADER_IMAGE}"
                  alt="الترويسة الرسمية"
                >
              </div>

              <div class="title">
                <h1>
                  استمارة الملاحظة الصفية الموحدة
                </h1>
                <p>
                  العام الدراسي
                  ${esc(
                    visit.academic_year ||
                    APP_CONFIG.academicYear
                  )}
                </p>
              </div>

              <div class="info-grid">

                <div class="info-item">
                  <span class="info-label">
                    اسم المعلمة
                  </span>
                  <span class="info-value">
                    ${esc(
                      teacher?.full_name ||
                      "—"
                    )}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    القسم
                  </span>
                  <span class="info-value">
                    ${esc(
                      department?.name ||
                      "—"
                    )}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    المادة
                  </span>
                  <span class="info-value">
                    ${esc(
                      subject?.name ||
                      "—"
                    )}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    التاريخ
                  </span>
                  <span class="info-value">
                    ${formatDate(
                      visit.visit_date
                    )}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    رقم الزيارة
                  </span>
                  <span class="info-value">
                    ${esc(
                      visit.visit_number ??
                      "—"
                    )}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    الصف / الشعبة
                  </span>
                  <span class="info-value">
                    ${esc(
                      visit.grade_section ||
                      "—"
                    )}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    الحصة
                  </span>
                  <span class="info-value">
                    ${esc(
                      visit.period_name ||
                      "—"
                    )}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    عنوان الدرس
                  </span>
                  <span class="info-value">
                    ${esc(
                      visit.lesson_title ||
                      "—"
                    )}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    عدد الطلبة
                  </span>
                  <span class="info-value">
                    ${visit.students_count ?? "—"}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    الغياب
                  </span>
                  <span class="info-value">
                    ${visit.absent_count ?? "—"}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    منفذ الزيارة
                  </span>
                  <span class="info-value">
                    ${esc(
                      evaluatorName(
                        visit
                      )
                    )}
                  </span>
                </div>

                <div class="info-item">
                  <span class="info-label">
                    المستوى القيادي
                  </span>
                  <span class="info-value">
                    ${esc(
                      evaluatorLevel(
                        visit
                      )
                    )}
                  </span>
                </div>

              </div>

              <div class="overall-box">
                <span>
                  الحكم العام للزيارة
                </span>
                <strong>
                  ${ratingLabel(
                    visit.overall_rating
                  )}
                </strong>
              </div>

              <table>

                <thead>
                  <tr>
                    <th class="criterion-text">
                      المعيار
                    </th>
                    <th class="rating-head">
                      يفي بالتوقعات جزئيًا
                    </th>
                    <th class="rating-head">
                      يفي بالتوقعات تمامًا
                    </th>
                    <th class="rating-head">
                      يتجاوز التوقعات
                    </th>
                    <th class="rating-head">
                      يتجاوز التوقعات بكثير
                    </th>
                    <th class="note-head">
                      ملاحظات
                    </th>
                  </tr>
                </thead>

                <tbody>
                  ${criteriaHTML}
                </tbody>

              </table>

              <div class="section">

                <div class="section-title">
                  مهارات القرن الحادي والعشرين
                </div>

                <div class="section-body check-grid">

                  ${
                    SKILLS.map(
                      (
                        [
                          field,
                          label
                        ]
                      ) => `
                        <div class="check-item">
                          <span class="yes">
                            ${
                              skillRow?.[
                                field
                              ] ===
                              true
                                ? "✓"
                                : "□"
                            }
                          </span>
                          ${esc(
                            label
                          )}
                        </div>
                      `
                    ).join("")
                  }

                </div>

              </div>

              <div class="section">

                <div class="section-title">
                  متابعة أعمال الطلبة
                  ${
                    workRow?.samples_count
                      ? ` — عدد العينات: ${workRow.samples_count}`
                      : ""
                  }
                </div>

                <div class="section-body check-grid">

                  ${
                    WORK_ITEMS.map(
                      (
                        [
                          field,
                          label
                        ]
                      ) => `
                        <div class="check-item">
                          <span class="yes">
                            ${
                              workRow?.[
                                field
                              ] ===
                              true
                                ? "✓"
                                : "□"
                            }
                          </span>
                          ${esc(
                            label
                          )}
                        </div>
                      `
                    ).join("")
                  }

                </div>

              </div>

              <div class="section">

                <div class="section-title">
                  التغذية الراجعة
                </div>

                <div class="section-body feedback-grid">

                  <div class="feedback-box">
                    <strong>
                      نجاحات المعلمة / نقاط القوة
                    </strong>
                    ${esc(
                      feedbackRow?.strengths ||
                      "—"
                    )}
                  </div>

                  <div class="feedback-box">
                    <strong>
                      جوانب بحاجة إلى تطوير
                    </strong>
                    ${esc(
                      feedbackRow?.development_areas ||
                      "—"
                    )}
                  </div>

                </div>

              </div>

              ${
                visit.general_notes
                  ? `
                      <div class="section">

                        <div class="section-title">
                          ملاحظات عامة
                        </div>

                        <div class="section-body">
                          ${esc(
                            visit.general_notes
                          )}
                        </div>

                      </div>
                    `
                  : ""
              }

              <div class="teacher-approval">

                <h3>
                  اعتماد المعلمة على الاطلاع
                </h3>

                <div class="approval-grid">

                  <div>
                    <span>
                      اسم المعلمة
                    </span>
                    <div class="signature-line">
                      ${esc(
                        teacher?.full_name ||
                        "—"
                      )}
                    </div>
                  </div>

                  <div>
                    <span>
                      التوقيع
                    </span>
                    <div class="signature-line">
                      &nbsp;
                    </div>
                  </div>

                  <div>
                    <span>
                      التاريخ
                    </span>
                    <div class="signature-line">
                      &nbsp;
                    </div>
                  </div>

                </div>

              </div>

              <div class="management-signatures">

                <div>
                  <span>
                    إعداد ومتابعة النظام
                  </span>
                  <strong>
                    ${REPORT_INFO.preparedBy}
                  </strong>
                </div>

                <div>
                  <span>
                    المديرة المساعدة
                  </span>
                  <strong>
                    ${REPORT_INFO.assistantPrincipal}
                  </strong>
                </div>

                <div>
                  <span>
                    مديرة المدرسة
                  </span>
                  <strong>
                    ${REPORT_INFO.principal}
                  </strong>
                </div>

              </div>

              <button
                class="print-btn"
                onclick="window.print()"
              >
                طباعة الاستمارة
              </button>

            </div>

          </body>

        </html>
      `
    );

    printWindow.document.close();
  };

/* =========================================================
   USERS
========================================================= */

function renderUsers() {
  const box =
    $("usersContent");

  if (
    !box ||
    currentProfile?.role !==
      "admin"
  ) {
    return;
  }

  const departmentOptions =
    activeRows(
      departments
    )
      .map(
        department => `
          <option
            value="${department.id}"
          >
            ${esc(
              department.name
            )}
          </option>
        `
      )
      .join("");

  box.innerHTML =
    `
      <div class="panel">

        <h3>
          إضافة مستخدم
        </h3>

        <form
          id="platformUserForm"
        >

          <div class="form-grid three">

            <label>

              الاسم

              <input
                id="platformUserName"
                required
              >

            </label>


            <label>

              البريد

              <input
                id="platformUserEmail"
                type="email"
                required
              >

            </label>


            <label>

              الصفة

              <select
                id="platformUserJobTitle"
                required
              >

                <option value="">
                  اختاري الصفة
                </option>

                <option>
                  مديرة المدرسة
                </option>

                <option>
                  مديرة مساعدة
                </option>

                <option>
                  منسقة قسم
                </option>

                <option>
                  مسؤولة النظام
                </option>

              </select>

            </label>


            <label
              id="platformUserDeptWrap"
              class="hidden"
            >

              القسم

              <select
                id="platformUserDepartment"
              >

                <option value="">
                  اختاري القسم
                </option>

                ${departmentOptions}

              </select>

            </label>

          </div>


          <div
            id="platformUserAutoLevel"
            class="analysis-note"
          >
            المستوى القيادي يحدد تلقائيًا.
          </div>


          <div class="form-actions">

            <button
              id="platformUserSubmit"
              class="btn btn-primary"
              type="submit"
            >
              إضافة المستخدم
            </button>

          </div>


          <div
            id="platformUserMsg"
            class="message"
          ></div>

        </form>

      </div>


      <div class="panel">

        <h3>
          المستخدمون المسجلون
        </h3>

        <div class="table-wrap">

          <table>

            <thead>

              <tr>
                <th>الاسم</th>
                <th>البريد</th>
                <th>الصفة</th>
                <th>المستوى القيادي</th>
                <th>القسم</th>
                <th>الحالة</th>
              </tr>

            </thead>

            <tbody>

              ${
                profiles
                  .map(
                    profile => `
                      <tr>

                        <td>
                          ${esc(
                            profile.full_name ||
                            "—"
                          )}
                        </td>

                        <td dir="ltr">
                          ${esc(
                            profile.email ||
                            "—"
                          )}
                        </td>

                        <td>
                          ${esc(
                            profile.job_title ||
                            (
                              profile.role ===
                              "admin"
                                ? "مسؤولة النظام"
                                : "—"
                            )
                          )}
                        </td>

                        <td>
                          ${esc(
                            leadershipLevel(
                              profile
                            )
                          )}
                        </td>

                        <td>
                          ${esc(
                            departments.find(
                              department =>
                                String(
                                  department.id
                                ) ===
                                String(
                                  profile.department_id
                                )
                            )?.name ||
                            "—"
                          )}
                        </td>

                        <td>
                          ${
                            profile.active ===
                            false
                              ? "غير نشط"
                              : "نشط"
                          }
                        </td>

                      </tr>
                    `
                  )
                  .join("")
              }

            </tbody>

          </table>

        </div>

      </div>
    `;

  const syncJob =
    () => {
      const job =
        $("platformUserJobTitle")
          ?.value ||
        "";

      const coordinator =
        job ===
        "منسقة قسم";

      $("platformUserDeptWrap")
        ?.classList
        .toggle(
          "hidden",
          !coordinator
        );

      if (
        $("platformUserDepartment")
      ) {
        $("platformUserDepartment").required =
          coordinator;
      }

      let level =
        "يحدد تلقائيًا";

      if (
        job ===
          "مديرة المدرسة" ||
        job ===
          "مديرة مساعدة"
      ) {
        level =
          "قيادة عليا";
      }
      else if (
        job ===
        "منسقة قسم"
      ) {
        level =
          "قيادة وسطى";
      }
      else if (
        job ===
        "مسؤولة النظام"
      ) {
        level =
          "لا ينطبق";
      }

      if (
        $("platformUserAutoLevel")
      ) {
        $("platformUserAutoLevel").textContent =
          `المستوى القيادي: ${level}`;
      }
    };

  $("platformUserJobTitle")
    ?.addEventListener(
      "change",
      syncJob
    );

  syncJob();

  $("platformUserForm")
    ?.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const full_name =
          $("platformUserName")
            .value
            .trim();

        const email =
          $("platformUserEmail")
            .value
            .trim()
            .toLowerCase();

        const job_title =
          $("platformUserJobTitle")
            .value;

        const department_id =
          job_title ===
          "منسقة قسم"
            ? num(
                $("platformUserDepartment")
                  .value
              )
            : null;

        const message =
          $("platformUserMsg");

        const button =
          $("platformUserSubmit");

        if (
          job_title ===
            "منسقة قسم" &&
          !department_id
        ) {
          message.className =
            "message danger";

          message.textContent =
            "اختاري القسم للمنسقة.";

          return;
        }

        try {
          button.disabled =
            true;

          button.textContent =
            "جاري الإنشاء...";

          const {
            data,
            error
          } =
            await sb.functions.invoke(
              "manage-users",
              {
                body: {
                  full_name,
                  email,
                  job_title,
                  department_id
                }
              }
            );

          if (
            error
          ) {
            throw error;
          }

          if (
            !data?.ok
          ) {
            throw new Error(
              data?.error ||
              "تعذر إنشاء المستخدم."
            );
          }

          message.className =
            "message success";

          message.textContent =
            "تم إنشاء المستخدم. ملاحظة: إرسال رسالة الدخول بالبريد يحتاج إعداد OTP/SMTP في المرحلة التالية.";

          await loadAll();

          fillUI();

          renderUsers();
        }
        catch (
          error
        ) {
          message.className =
            "message danger";

          message.textContent =
            error.message ||
            "تعذر إنشاء المستخدم.";
        }
        finally {
          if (
            button
          ) {
            button.disabled =
              false;

            button.textContent =
              "إضافة المستخدم";
          }
        }
      }
    );
}

/* =========================================================
   MASTER DATA
========================================================= */

function renderMasterSummary() {
  if (
    $("masterSummary")
  ) {
    $("masterSummary").innerHTML =
      `
        <div class="executive-kpi-grid">

          <article class="executive-kpi">

            <span>
              المعلمات
            </span>

            <strong>
              ${activeRows(teachers).length}
            </strong>

          </article>


          <article class="executive-kpi">

            <span>
              الأقسام
            </span>

            <strong>
              ${activeRows(departments).length}
            </strong>

          </article>


          <article class="executive-kpi">

            <span>
              المواد
            </span>

            <strong>
              ${activeRows(subjects).length}
            </strong>

          </article>


          <article class="executive-kpi">

            <span>
              المعايير
            </span>

            <strong>
              ${criteria.length}
            </strong>

          </article>

        </div>
      `;
  }
}

/* =========================================================
   NAVIGATION
========================================================= */

const VIEW_MAP = {
  dashboard:
    "dashboardView",

  newVisit:
    "newVisitView",

  history:
    "historyView",

  monthly:
    "monthlyView",

  overall:
    "overallView",

  support:
    "supportView",

  reports:
    "reportsView",

  users:
    "usersView",

  masterdata:
    "masterdataView"
};

const VIEW_TITLES = {
  dashboard:
    "الرئيسية",

  newVisit:
    "زيارة جديدة",

  history:
    "سجل الزيارات",

  monthly:
    "التحليل الشهري",

  overall:
    "التحليل الشامل",

  support:
    "الدعم والمتابعة",

  reports:
    "التقارير الرسمية",

  users:
    "إدارة المستخدمين",

  masterdata:
    "البيانات الأساسية"
};

function showView(
  name
) {
  const id =
    VIEW_MAP[
      name
    ];

  if (!id) {
    return;
  }

  document
    .querySelectorAll(
      ".view"
    )
    .forEach(
      view =>
        view.classList.add(
          "hidden"
        )
    );

  $(id)
    ?.classList
    .remove(
      "hidden"
    );

  document
    .querySelectorAll(
      "[data-view]"
    )
    .forEach(
      item =>
        item.classList.remove(
          "active"
        )
    );

  document
    .querySelector(
      `[data-view="${name}"]`
    )
    ?.classList
    .add(
      "active"
    );

  if (
    $("pageTitle")
  ) {
    $("pageTitle").textContent =
      VIEW_TITLES[
        name
      ] ||
      "منظومة الزيارات الصفية";
  }

  if (
    name ===
    "dashboard"
  ) {
    renderDashboard();
  }

  if (
    name ===
    "history"
  ) {
    renderHistory();
  }

  if (
    name ===
    "monthly"
  ) {
    renderMonthly();
  }

  if (
    name ===
    "overall"
  ) {
    renderOverall();
  }

  if (
    name ===
    "support"
  ) {
    renderSupport();
  }

  if (
    name ===
    "users"
  ) {
    renderUsers();
  }

  if (
    name ===
    "masterdata"
  ) {
    renderMasterSummary();
  }

  if (
    name ===
    "reports"
  ) {
    generateReport();
  }

  if (
    name ===
    "newVisit"
  ) {
    updateEvaluatorBlock();
  }
}

function bindNavigation() {
  document
    .querySelectorAll(
      "[data-view]"
    )
    .forEach(
      item =>
        item.addEventListener(
          "click",
          event => {
            event.preventDefault();

            showView(
              item.dataset.view
            );
          }
        )
    );
}

/* =========================================================
   PERMISSIONS
========================================================= */

function applyPermissionsUI() {
  const admin =
    currentProfile?.role ===
    "admin";

  document
    .querySelectorAll(
      ".admin-only,[data-admin-only]"
    )
    .forEach(
      element =>
        element.classList.toggle(
          "hidden",
          !admin
        )
    );
}

/* =========================================================
   CURRENT USER
========================================================= */

function renderCurrentUser() {
  if (
    $("userInfo")
  ) {
    $("userInfo").innerHTML =
      `
        <strong>

          ${esc(
            currentProfile?.full_name ||
            currentUser?.email ||
            "مستخدم"
          )}

        </strong>

        <span>

          ${esc(
            currentProfile?.job_title ||
            (
              currentProfile?.role ===
              "admin"
                ? "مسؤولة النظام"
                : "مستخدم المنصة"
            )
          )}

        </span>
      `;
  }

  if (
    $("yearBadge")
  ) {
    $("yearBadge").textContent =
      APP_CONFIG.academicYear;
  }

  updateEvaluatorBlock();
}

/* =========================================================
   RENDER ALL
========================================================= */

function renderAll() {
  renderCurrentUser();

  applyPermissionsUI();

  renderDashboard();

  renderHistory();

  renderMonthly();

  renderOverall();

  renderSupport();

  renderMasterSummary();
}

/* =========================================================
   EVENTS
========================================================= */

function bindStaticEvents() {
  $("departmentSelect")
    ?.addEventListener(
      "change",
      () =>
        updateSubjectSelect()
    );

  $("visitObserverSelect")
    ?.addEventListener(
      "change",
      updateEvaluatorBlock
    );

  document
    .addEventListener(
      "change",
      event => {
        if (
          event.target
            ?.matches?.(
              'input[name^="criterion_"]'
            ) ||
          event.target?.id ===
            "overallRating"
        ) {
          updateConsistencyHint();
        }
      }
    );

  [
    "histMonth",
    "histTeacher",
    "histDept",
    "histSubject",
    "histRating"
  ]
    .forEach(
      id =>
        $(id)
          ?.addEventListener(
            "change",
            renderHistory
          )
    );

  $("monthlyMonth")
    ?.addEventListener(
      "change",
      renderMonthly
    );

  [
    "dashboardDeptFilter",
    "dashboardTeacherFilter",
    "dashboardFromMonth",
    "dashboardToMonth"
  ].forEach(
    id =>
      $(id)
        ?.addEventListener(
          "change",
          renderDashboard
        )
  );

  [
    "monthlyDeptFilter",
    "monthlyTeacherFilter"
  ].forEach(
    id =>
      $(id)
        ?.addEventListener(
          "change",
          renderMonthly
        )
  );

  [
    "overallDeptFilter",
    "overallTeacherFilter",
    "overallFromMonth",
    "overallToMonth"
  ].forEach(
    id =>
      $(id)
        ?.addEventListener(
          "change",
          renderOverall
        )
  );

  [
    "reportDeptFilter",
    "reportTeacherFilter",
    "reportFromMonth",
    "reportToMonth"
  ].forEach(
    id =>
      $(id)
        ?.addEventListener(
          "change",
          generateReport
        )
  );

  $("refreshMonthly")
    ?.addEventListener(
      "click",
      renderMonthly
    );

  $("supportTeacherFilter")
    ?.addEventListener(
      "change",
      renderSupport
    );

  $("supportStatusFilter")
    ?.addEventListener(
      "change",
      renderSupport
    );

  $("visitForm")
    ?.addEventListener(
      "submit",
      saveVisit
    );

  $("generateReport")
    ?.addEventListener(
      "click",
      generateReport
    );

  $("generateNarrative")
    ?.addEventListener(
      "click",
      generateNarrative
    );

  $("printReport")
    ?.addEventListener(
      "click",
      () => {
        if (
          !$("reportOutput")
            ?.innerHTML
            .trim()
        ) {
          alert(
            "أنشئي التقرير أولًا."
          );

          return;
        }

        window.print();
      }
    );

  document
    .querySelectorAll(
      'input[name="mainReportMode"]'
    )
    .forEach(
      radio =>
        radio.addEventListener(
          "change",
          () => {
            $("reportMonthWrap")
              ?.classList
              .toggle(
                "hidden",
                selectedReportMode() ===
                "overall"
              );

            generateReport();
          }
        )
    );

  $("reportMonth")
    ?.addEventListener(
      "change",
      generateReport
    );

  $("teacherForm")
    ?.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const name =
          $("newTeacherName")
            ?.value
            .trim();

        if (!name) {
          return;
        }

        const {
          error
        } =
          await sb
            .from(
              "teachers"
            )
            .insert(
              {
                full_name:
                  name,

                active:
                  true
              }
            );

        if (
          error
        ) {
          $("teacherMsg").textContent =
            error.message;

          return;
        }

        $("newTeacherName").value =
          "";

        await loadAll();

        fillUI();

        renderAll();

        $("teacherMsg").textContent =
          "تمت إضافة المعلمة.";
      }
    );

  $("deptForm")
    ?.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const name =
          $("newDeptName")
            ?.value
            .trim();

        if (!name) {
          return;
        }

        const {
          error
        } =
          await sb
            .from(
              "departments"
            )
            .insert(
              {
                name,
                active:
                  true
              }
            );

        if (
          error
        ) {
          $("deptMsg").textContent =
            error.message;

          return;
        }

        $("newDeptName").value =
          "";

        await loadAll();

        fillUI();

        renderAll();

        $("deptMsg").textContent =
          "تمت إضافة القسم.";
      }
    );

  $("subjectForm")
    ?.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const department_id =
          num(
            $("newSubjectDept")
              ?.value
          );

        const name =
          $("newSubjectName")
            ?.value
            .trim();

        if (
          !department_id ||
          !name
        ) {
          return;
        }

        const {
          error
        } =
          await sb
            .from(
              "subjects"
            )
            .insert(
              {
                department_id,
                name,
                active:
                  true
              }
            );

        if (
          error
        ) {
          $("subjectMsg").textContent =
            error.message;

          return;
        }

        $("newSubjectName").value =
          "";

        await loadAll();

        fillUI();

        renderAll();

        $("subjectMsg").textContent =
          "تمت إضافة المادة.";
      }
    );

  $("logoutBtn")
    ?.addEventListener(
      "click",
      async () => {
        await sb.auth.signOut();

        location.href =
          "index.html";
      }
    );
}

/* =========================================================
   BOOT ERROR
========================================================= */

function showBootError(
  error
) {
  console.error(
    error
  );

  document.body.innerHTML =
    `
      <main
        style="
          max-width:760px;
          margin:70px auto;
          padding:30px;
          font-family:Tahoma,Arial;
          direction:rtl;
        "
      >

        <div
          style="
            background:white;
            border-radius:18px;
            padding:30px;
            box-shadow:0 18px 50px rgba(0,0,0,.08);
          "
        >

          <h2
            style="
              color:#a32f29;
            "
          >
            تعذر تشغيل المنصة
          </h2>

          <p>
            ${esc(
              error?.message ||
              "حدث خطأ أثناء التشغيل."
            )}
          </p>

          <button
            onclick="location.reload()"
          >
            إعادة المحاولة
          </button>

        </div>

      </main>
    `;
}

/* =========================================================
   BOOT
========================================================= */

async function boot() {
  try {
    const hasSession =
      await ensureSession();

    if (
      !hasSession
    ) {
      return;
    }

    await loadCurrentProfile();

    await loadAll();

    fillUI();

    bindNavigation();

    bindStaticEvents();

    renderAll();

    if (
      $("visitDate") &&
      !$("visitDate").value
    ) {
      $("visitDate").value =
        new Date()
          .toISOString()
          .slice(
            0,
            10
          );
    }

    showView(
      "dashboard"
    );
  }
  catch (
    error
  ) {
    showBootError(
      error
    );
  }
}

document.addEventListener(
  "DOMContentLoaded",
  boot
);