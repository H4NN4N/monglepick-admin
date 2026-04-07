/**
 * 운영 도구 — 리워드 정책(RewardPolicy) 관리 API.
 *
 * 백엔드 AdminRewardPolicyController(/api/v1/admin/reward-policies) 6개 EP.
 *
 * - 목록 조회 (페이징)
 * - 단건 조회
 * - 변경 이력 조회 (INSERT-ONLY 원장)
 * - 신규 등록 (action_type UNIQUE)
 * - 메타 수정 (actionType 제외)
 * - 활성 토글
 *
 * 모든 변경 작업은 RewardPolicyHistory에 자동 기록되며, 이력은 변경/삭제 불가.
 */

import { backendApi } from '@/shared/api/axiosInstance';

const BASE = '/api/v1/admin/reward-policies';

export function fetchRewardPolicies(params = {}) {
  return backendApi.get(BASE, { params });
}

export function fetchRewardPolicy(id) {
  return backendApi.get(`${BASE}/${id}`);
}

export function fetchRewardPolicyHistory(id) {
  return backendApi.get(`${BASE}/${id}/history`);
}

export function createRewardPolicy(payload) {
  return backendApi.post(BASE, payload);
}

export function updateRewardPolicy(id, payload) {
  return backendApi.put(`${BASE}/${id}`, payload);
}

export function updateRewardPolicyActive(id, isActive, changeReason) {
  return backendApi.patch(`${BASE}/${id}/active`, { isActive, changeReason });
}
