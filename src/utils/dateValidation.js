/**
 * 관리자 페이지 날짜 폼 공통 밸리데이션 유틸.
 * datetime-local / date 타입 input 값(문자열)을 그대로 비교한다.
 * ISO 8601 사전순 정렬 == 시간순 정렬이므로 문자열 비교로 충분하다.
 */

/**
 * 시작일 < 종료일 검증.
 * @param {string} start datetime-local / date 문자열
 * @param {string} end   datetime-local / date 문자열
 * @param {string} [startLabel]
 * @param {string} [endLabel]
 * @returns {string|null} 오류 메시지 또는 null
 */
export function validateDateRange(start, end, startLabel = '시작일', endLabel = '종료일') {
  if (start && end && start >= end) {
    return `${endLabel}은(는) ${startLabel}보다 이후 시간이어야 합니다.`;
  }
  return null;
}

/**
 * 필수 날짜 검증.
 * @param {string} value
 * @param {string} label
 * @returns {string|null}
 */
export function validateRequiredDate(value, label) {
  if (!value) return `${label}을(를) 입력해주세요.`;
  return null;
}

/**
 * 현재 시각 이후인지 검증 (미래 날짜 강제).
 * @param {string} value datetime-local / date 문자열
 * @param {string} label
 * @returns {string|null}
 */
export function validateFutureDate(value, label) {
  if (!value) return null;
  const today = new Date().toISOString().slice(0, value.length);
  if (value < today) return `${label}은(는) 현재 시각 이후여야 합니다.`;
  return null;
}

/**
 * 여러 오류 중 첫 번째를 반환한다.
 * @param {...(string|null)} errors
 * @returns {string|null}
 */
export function firstError(...errors) {
  return errors.find(Boolean) ?? null;
}
