/**
 * Settings "개인정보 처리방침" and "이용약관", opened from the settings list. Written from what the app
 * actually does (on-device storage, 24-hour expiry, user-initiated sharing only); change the text
 * together with the behaviour it describes. Legal wording has not been reviewed by counsel.
 */
export type PolicySection = { heading: string; paragraphs?: string[]; items?: string[] };
export type PolicyDocument = { title: string; intro: string; sections: PolicySection[]; effective?: string };

/** Contact shown in both documents. */
export const POLICY_CONTACT_EMAIL = "contact@gjfire.xyz";
export const POLICY_CONTACT = `이메일(${POLICY_CONTACT_EMAIL})`;
export const POLICY_EFFECTIVE = "2026년 11월 1일";

export const PRIVACY_POLICY: PolicyDocument = {
  title: "개인정보 처리방침",
  intro:
    "119 | FIELD NOTE(이하 \"앱\")는 구급대원이 현장 기록을 작성하도록 돕는 기기 내 기록 도구입니다. 앱 제작자(이하 \"제작자\")는 「개인정보 보호법」 등 관계 법령을 준수하며, 앱에서 다루는 개인정보가 어떻게 처리되는지 다음과 같이 안내합니다.",
  sections: [
    {
      heading: "제1조 (개인정보 처리의 원칙)",
      paragraphs: [
        "앱은 회원가입이나 로그인 절차가 없으며, 사용자가 입력한 기록을 제작자의 서버나 제3자의 서버로 전송하지 않습니다. 모든 기록은 사용자의 기기 내부 저장소에만 보관됩니다.",
        "따라서 제작자는 앱에 입력된 환자 정보나 사용자 정보를 수집하거나 열람하지 않습니다. 앱을 업무에 사용하는 경우, 기록의 처리 책임은 사용자 및 사용자가 소속된 기관의 개인정보 처리 기준에 따릅니다.",
      ],
    },
    {
      heading: "제2조 (처리하는 개인정보의 항목)",
      paragraphs: ["앱은 사용자가 직접 입력하거나 촬영·녹음한 다음 정보를 기기 안에서 처리합니다."],
      items: [
        "환자 정보: 이름, 생년월일, 성별, 연락처, 주증상, 활력징후, 병력, 복용 약물, 메모, 손글씨 기록",
        "보호자 정보: 환자와의 관계, 이름, 연락처",
        "촬영·녹음 자료: 신분증 사진, 환부 사진, 처방전·약 봉투 사진, 현장 녹취",
        "사용자 정보: 소속, 계급, 성명(문자 전송 시 발신자 표시용)",
        "앱 설정: 화면 모드, 글자 크기, 언어, 날짜 입력 방식",
      ],
    },
    {
      heading: "제3조 (개인정보의 처리 목적)",
      items: [
        "구급 현장 기록의 작성 및 확인",
        "이송 병원, 의료진, 관계 기관에 대한 기록 전달(사용자가 직접 실행하는 경우에 한함)",
        "신분증 사진에서 이름·생년월일을 인식하여 입력을 돕는 기능",
        "처방전 사진으로 복용 약물을 확인하는 기능(사용자가 직접 실행하는 경우에 한함)",
      ],
    },
    {
      heading: "제4조 (개인정보의 보유 기간 및 파기)",
      paragraphs: [
        "환자 기록은 등록 후 24시간이 지나면 해당 기록에 딸린 사진, 녹취, 손글씨, 신분증 사진과 함께 기기에서 자동으로 파기됩니다. 사용자는 그 전에 언제든지 개별 기록 또는 전체 기록을 직접 삭제할 수 있습니다.",
        "처방전 분석을 위해 만든 임시 사진은 분석 화면을 닫거나 앱을 다시 실행할 때 즉시 삭제되며, 환자 기록에 저장되지 않습니다.",
        "사용자 정보와 앱 설정은 사용자가 직접 수정·삭제하거나 앱을 삭제할 때까지 기기에 보관됩니다.",
        "파기된 기록은 기기 저장소에서 삭제되어 앱에서 복구할 수 없습니다.",
      ],
    },
    {
      heading: "제5조 (개인정보의 제3자 제공 및 국외 이전)",
      paragraphs: [
        "제작자는 개인정보를 제3자에게 제공하지 않습니다. 다만 사용자가 다음 기능을 직접 실행하는 경우, 사용자가 선택한 정보가 해당 앱으로 전달됩니다.",
      ],
      items: [
        "문자 보내기: 사용자가 고른 기록과 사진이 기기의 문자 앱으로 전달되며, 전송 여부와 수신자는 사용자가 문자 앱에서 최종 결정합니다.",
        "처방전 분석: 사용자가 영역을 지정하고 가린 처방전 사진과 분석 요청 문구가 사용자 기기의 ChatGPT 앱(OpenAI)으로 전달됩니다. ChatGPT로 전달된 정보는 국외(OpenAI의 서버)에서 처리될 수 있으며, 그 처리는 OpenAI의 개인정보 처리방침에 따릅니다.",
      ],
    },
    {
      heading: "제6조 (개인정보 처리의 위탁)",
      paragraphs: ["제작자는 개인정보 처리 업무를 외부에 위탁하지 않습니다."],
    },
    {
      heading: "제7조 (기기 내 인식 기능)",
      paragraphs: [
        "신분증 인식은 앱에 포함된 Google ML Kit 문자 인식 기능으로 기기 안에서 처리됩니다. 인식에 사용한 사진과 인식 결과는 외부로 전송되지 않습니다.",
      ],
    },
    {
      heading: "제8조 (접근 권한)",
      paragraphs: ["앱은 다음 권한을 기능 사용 시점에 요청하며, 허용하지 않아도 해당 기능을 제외한 기록 작성은 가능합니다."],
      items: [
        "카메라(선택): 신분증 인식, 환부 사진, 처방전 촬영",
        "마이크(선택): 현장 녹취",
        "사진 선택(선택): 처방전 사진을 앨범에서 고를 때 시스템 사진 선택기를 사용하며, 저장소 전체 접근 권한은 요청하지 않습니다.",
      ],
    },
    {
      heading: "제9조 (정보주체의 권리와 행사 방법)",
      paragraphs: [
        "기록은 사용자 기기에만 있으므로, 열람·정정·삭제는 사용자가 앱에서 직접 할 수 있습니다. 환자 또는 보호자가 권리를 행사하려는 경우, 기록을 작성한 사용자 또는 그 소속 기관에 요청할 수 있습니다.",
      ],
    },
    {
      heading: "제10조 (개인정보의 안전성 확보 조치)",
      items: [
        "기록을 기기 내부 저장소에만 보관하고 외부 서버로 전송하지 않음",
        "등록 후 24시간이 지난 기록의 자동 파기",
        "기기 백업 기능으로 기록이 복사되지 않도록 설정",
        "처방전 분석용 사진에서 위치 등 메타데이터(EXIF) 제거, 보낼 영역 지정 및 가리기 기능 제공",
      ],
      paragraphs: ["사용자는 기기 분실·도난에 대비하여 화면 잠금을 설정해야 합니다."],
    },
    {
      heading: "제11조 (자동 수집 장치)",
      paragraphs: ["앱은 쿠키, 광고 식별자, 사용 기록 분석 도구를 사용하지 않습니다."],
    },
    {
      heading: "제12조 (문의처)",
      paragraphs: [`개인정보 처리와 관련한 문의는 ${POLICY_CONTACT}을 통해 접수할 수 있습니다.`],
    },
    {
      heading: "제13조 (처리방침의 변경)",
      paragraphs: ["이 처리방침의 내용이 변경되는 경우, 앱 업데이트 또는 배포 홈페이지를 통해 시행 전에 안내합니다."],
    },
  ],
  effective: POLICY_EFFECTIVE,
};

export const TERMS_OF_USE: PolicyDocument = {
  title: "이용약관",
  intro: "이 약관은 119 | FIELD NOTE(이하 \"앱\")의 이용 조건과 절차, 이용자와 앱 제작자(이하 \"제작자\")의 권리·의무 및 책임 사항을 정합니다.",
  sections: [
    {
      heading: "제1조 (목적과 적용)",
      paragraphs: ["이 약관은 이용자가 앱을 설치하거나 사용하는 시점부터 적용됩니다. 이용자가 약관에 동의하지 않는 경우 앱 사용을 중단하고 삭제할 수 있습니다."],
    },
    {
      heading: "제2조 (앱의 성격)",
      items: [
        "앱은 구급대원의 현장 기록 작성을 돕는 보조 도구입니다.",
        "앱은 의료기기가 아니며, 진단·처치·이송에 관한 판단을 대신하지 않습니다.",
        "앱이 계산하거나 표시하는 값(나이, 평균동맥압 등)과 인식 결과는 참고용이며, 이용자는 원 자료와 대조하여 확인해야 합니다.",
      ],
    },
    {
      heading: "제3조 (제공 기능)",
      items: [
        "환자 인적사항, 주증상, 활력징후, 병력, 복용 약물, 메모, 손글씨 기록 작성",
        "신분증 촬영 및 기기 내 이름·생년월일 인식",
        "환부 사진 촬영, 현장 녹취",
        "기록과 사진의 문자 전송(기기의 문자 앱 이용)",
        "처방전 사진의 ChatGPT 분석 요청(이용자 기기의 ChatGPT 앱 이용)",
        "등록 후 24시간이 지난 기록의 자동 파기",
      ],
    },
    {
      heading: "제4조 (이용자의 의무)",
      items: [
        "환자·보호자에게 촬영·녹취 목적을 알리고, 동의를 받은 범위에서만 촬영·녹취해야 합니다.",
        "기록을 관계 법령과 소속 기관의 기준에 따라 작성·전달·보관해야 합니다.",
        "문자 수신자와 첨부 사진을 전송 전에 확인해야 합니다. 잘못 전송된 문자는 앱에서 회수할 수 없습니다.",
        "처방전 분석 시 환자 외 개인정보(이름, 병원·약국명 등)가 보이지 않도록 영역을 지정하거나 가려야 합니다.",
        "필요한 기록은 자동 파기 전에 전달해야 하며, 기기에 화면 잠금을 설정해야 합니다.",
      ],
    },
    {
      heading: "제5조 (금지 행위)",
      items: [
        "동의 없는 촬영·녹취 등 타인의 권리를 침해하는 행위",
        "앱을 수집한 개인정보의 목적 외 이용이나 무단 제공에 사용하는 행위",
        "앱을 변조·역설계하거나 정상적인 작동을 방해하는 행위",
      ],
    },
    {
      heading: "제6조 (외부 서비스)",
      paragraphs: [
        "문자 앱과 ChatGPT 앱은 각 제공자가 운영하는 별도의 서비스입니다. 해당 서비스로 전달된 정보의 처리, 전송 결과, 분석 내용의 정확성은 각 서비스의 약관과 정책에 따르며, ChatGPT 분석 결과에는 오류가 있을 수 있습니다.",
      ],
    },
    {
      heading: "제7조 (책임의 제한)",
      paragraphs: [
        "기록의 작성, 전송, 보관과 현장 판단에 대한 책임은 이용자에게 있습니다.",
        "제작자는 이용자의 입력 오류, 기기 관리 소홀, 이용자가 실행한 외부 전송, 외부 서비스의 장애나 분석 오류, 자동 파기 전 기록을 전달하지 않아 생긴 결과에 대하여 책임을 지지 않습니다.",
        "다만 제작자의 고의 또는 중대한 과실로 인한 손해 등 관계 법령상 책임을 면할 수 없는 경우에는 그러하지 아니합니다.",
      ],
    },
    {
      heading: "제8조 (앱의 변경과 중단)",
      paragraphs: ["제작자는 기능 개선이나 운영상 필요에 따라 앱의 기능을 변경하거나 배포를 중단할 수 있으며, 중요한 변경은 앱 업데이트 또는 배포 홈페이지를 통해 안내합니다."],
    },
    {
      heading: "제9조 (지식재산권)",
      paragraphs: ["앱과 앱에 포함된 디자인, 문구, 이미지에 대한 권리는 제작자 또는 정당한 권리자에게 있습니다. 이용자가 작성한 기록에 대한 권리는 이용자와 소속 기관에 있습니다."],
    },
    {
      heading: "제10조 (약관의 변경)",
      paragraphs: ["제작자는 관계 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경 내용과 시행일을 시행 전에 안내합니다."],
    },
    {
      heading: "제11조 (오픈소스 소프트웨어)",
      paragraphs: [
        "앱에는 오픈소스 소프트웨어와 글꼴이 포함되어 있으며, 각 저작권자의 라이선스 조건에 따라 사용합니다. 포함된 소프트웨어 목록과 라이선스 원문은 앱의 설정 > 오픈소스 라이선스에서 확인할 수 있습니다.",
      ],
    },
    {
      heading: "제12조 (준거법과 분쟁 해결)",
      paragraphs: [`이 약관은 대한민국 법률에 따라 해석됩니다. 앱 이용과 관련한 문의는 ${POLICY_CONTACT}을 통해 접수할 수 있습니다.`],
    },
  ],
  effective: POLICY_EFFECTIVE,
};

/** Settings > 오픈소스 라이선스: what ships inside the APK, with the notices those licenses ask to be shown. */
export const OPEN_SOURCE_NOTICES: PolicyDocument = {
  title: "오픈소스 라이선스",
  intro: "이 앱에는 다음 오픈소스 소프트웨어와 글꼴이 포함되어 있습니다. 각 저작권자에게 감사드립니다.",
  sections: [
    {
      heading: "포함된 소프트웨어",
      items: [
        "React Native, React — Copyright (c) Meta Platforms, Inc. and affiliates. MIT License",
        "Expo SDK 및 Expo 모듈(카메라, 오디오, 파일, 이미지, 사진 선택, 문자, 시작 화면 등) — Copyright (c) 650 Industries, Inc. (Expo). MIT License",
        "react-native-svg, react-native-view-shot, react-native-webview, react-native-safe-area-context, @react-native-async-storage/async-storage, @quidone/react-native-wheel-picker, react-native-document-scanner-plugin, @infinitered/react-native-mlkit-text-recognition — 각 저작권자. MIT License",
        "three.js(시작 화면 효과) — Copyright (c) 2010-2026 three.js authors. MIT License",
        "Android Jetpack(AndroidX, CameraX) — Copyright (c) The Android Open Source Project. Apache License 2.0",
        "Pretendard 글꼴 — Copyright (c) 2021, Kil Hyung-jin. SIL Open Font License 1.1",
        "Barlow Condensed 글꼴(시작 화면) — Copyright 2017 The Barlow Project Authors. SIL Open Font License 1.1",
        "Google ML Kit 문자 인식 — Google의 ML Kit 이용약관에 따라 기기 안에서 사용",
      ],
    },
    {
      heading: "MIT License",
      paragraphs: [
        "Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.",
      ],
    },
    {
      heading: "Apache License 2.0",
      paragraphs: ["Licensed under the Apache License, Version 2.0. 원문: https://www.apache.org/licenses/LICENSE-2.0"],
    },
    {
      heading: "SIL Open Font License 1.1",
      paragraphs: [
        "This Font Software is licensed under the SIL Open Font License, Version 1.1. 원문: https://openfontlicense.org",
        "글꼴은 앱 화면 표시에만 사용하며 따로 판매하거나 배포하지 않습니다.",
      ],
    },
  ],
};
