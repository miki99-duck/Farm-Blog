---
title: "第13章 Spring Security 7 详解"
tags: [Spring]
---

# 第13章 Spring Security 7 详解

> 学习定位：不迁移也好用的知识点——Security 7 的 DSL 更直白，理解它能顺手
> 看懂你 RuoYi 项目里的 SecurityConfig 到底在配什么。
> 本章主线：认证(Authentication) → 授权(Authorization) → 攻击防护(CSRF等) → 新特性。

## 1. 版本脉络与定位

| 版本 | 变化 |
|------|------|
| Security 5.x | 经典 XML/custom 风格，DSL 混乱，antMatcher |
| Security 6.x（Boot 3 配套） | 默认启用新 DSL，废弃 antMatcher |
| **Security 7.x（Boot 4 配套）** | 删干净过时 API，DSL 定型，OAuth2/OIDC 第一公民 |

本质：**Security 7 不是加了新功能，而是把 5.x 时代的糟粕删掉、把写法统一。**
对学习者反而是好事：API 更少、名字更直观。

## 2. 核心骨架：过滤器链（FilterChain）

Security 的本质是一个**过滤器链**，请求穿过 N 个过滤器，每个过滤器管一件事：

```
客户端请求
  ↓
SecurityContextPersistenceFilter     从 Session/Token 恢复登录状态
  ↓
CsrfFilter                           校验 CSRF Token（写操作）
  ↓
UsernamePasswordAuthenticationFilter 处理 /login 表单登录
  ↓                                    ← API 场景常用 JWT：这一环换成自定义 Filter
BasicAuthenticationFilter / BearerTokenAuthenticationFilter
  ↓
AuthorizationFilter                  最后统一做授权判断（方法级/URL 级）
  ↓
Controller
```

关键理解：
- **认证（谁是你）**：AuthenticationManager → AuthenticationProvider → UserDetailsService。
- **授权（你能干嘛）**：AuthorizationManager（Security 7 里统一入口）。
- 你自己加的过滤器（JWT 解析等）就插在这一串中间，顺序敏感。

## 3. 认证流程（一张图）

```
登录请求(username/password)
  → UsernamePasswordAuthenticationFilter
  → 封装成 UsernamePasswordAuthenticationToken(未认证)
  → AuthenticationManager（ProviderManager，管一堆 Provider）
       → DaoAuthenticationProvider
            → UserDetailsService.loadUserByUsername()  ← 查你项目的用户表
            → PasswordEncoder.matches(明文, 数据库密文)   ← BCrypt 比对
  → 认证成功：SecurityContext 里放 Authentication(已认证)
  → 认证失败：抛 BadCredentialsException → 401
```

你 RuoYi 项目里的细节对应：
- RuoYi 用 **JWT**：登录成功后签发 token，之后每次请求由自定义 Filter
  解析 token → 把用户塞进 SecurityContext（跳过了 UsernamePasswordAuthenticationFilter）。
- 数据库里的密码是 BCrypt 加密 → 对应 PasswordEncoder 是 BCryptPasswordEncoder。

```java
// 自定义认证（RuoYi 风格 JWT 校验过滤器，Security 6/7 写法）
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res,
                                    FilterChain chain) {
        String token = resolveToken(req);
        if (token != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            LoginUser user = jwtService.parseToken(token);      // 自己解析
            var auth = new UsernamePasswordAuthenticationToken(
                    user, null, user.getAuthorities());         // Authorities = 角色权限
            SecurityContextHolder.getContext().setAuthentication(auth);  // 放进去
        }
        chain.doFilter(req, res);
    }
}
```

## 4. 授权：Security 7 的 DSL（重点看变化）

Security 5 时代（你现在 RuoYi 里可能长的样子）：
```java
http.authorizeRequests()
        .antMatchers("/login", "/captchaImage").permitAll()   // ❌ 已删除
        .antMatchers("/system/**").hasRole("ADMIN")
        .anyRequest().authenticated()
        .and().csrf().disable();                               // ❌ 已删除
```

Security 7 写法（当前标准）：
```java
@Bean
SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .authorizeHttpRequests(auth -> auth            // ✅ 类型安全 lambda
            .requestMatchers("/login", "/captcha").permitAll()
            .requestMatchers("/system/**").hasRole("ADMIN")
            .anyRequest().authenticated())
        .csrf(AbstractHttpConfigurer::disable)          // ✅ 显式 disable 语法
        .sessionManagement(s -> s
            .sessionCreationPolicy(SessionCreationPolicy.STATELESS))  // 无状态(JWT)
        .exceptionHandling(e -> e
            .authenticationEntryPoint(unauthorizedHandler)   // 401 处理
            .accessDeniedHandler(forbiddenHandler));         // 403 处理
    return http.build();
}
```

变化对照表（背下来）：

| Security 5（旧） | Security 6/7（新） |
|-----------------|-------------------|
| authorizeRequests() | authorizeHttpRequests() |
| antMatchers("/x/**") | requestMatchers("/x/**") |
| mvcMatchers() | requestMatchers() |
| csrf().disable() | csrf(AbstractHttpConfigurer::disable) |
| .and() 链式拼接 | lambda 分区配置，无 and() |
| WebSecurityConfigurerAdapter 继承 | SecurityFilterChain @Bean 组件 |
| 方法级 @PreAuthorize 手动开启 | @PreAuthorize 默认支持（@EnableMethodSecurity） |

为什么说新写法好：类型安全、各配置分区隔离、不再有".and() 一下不知道回哪层"的困惑。

## 5. 方法级授权

```java
@EnableMethodSecurity   // Security 6+ 用这个，替代旧 @EnableGlobalMethodSecurity

@RestController
public class DeviceController {
    @PreAuthorize("hasRole('ADMIN')")                    // 角色
    @GetMapping("/devices")
    public List<Device> list() { ... }

    @PreAuthorize("@permService.check(deviceId, 'WRITE')")  // SpEL 调 Bean（RuoYi 风格）
    @PutMapping("/devices/{id}")
    public Result update(@PathVariable Long id) { ... }
}
```

## 6. 攻击防护：Security 的隐藏价值

| 攻击 | Security 怎么防 |
|------|----------------|
| CSRF | CsrfFilter 校验 Token（浏览器表单/API 无状态场景可关） |
| Session 固定 | 登录成功自动更换 SessionId |
| 点击劫持 | 默认 X-Frame-Options: DENY |
| 明文密码 | BCryptPasswordEncoder（内置 cost 自适应） |
| 暴力破解 | 可配置登录失败锁定（业务层实现） |

## 7. Security 7 新增/强化点

1. **OAuth2/OIDC 第一公民**：授权服务器/资源服务器配置比 6.x 简洁得多，
   企业内部 SSO、接第三方登录（微信/钉钉）都走这套。
2. **无状态默认**：JWT/API 场景的配置就是标准姿势，不再需要一堆 workaround。
3. **CVE 响应快**：跟随 Boot 4 同步维护，留在旧版 = 只有商业补丁。

```yaml
# OIDC 资源服务器（Boot 4 + Security 7）：几行配置接入企业 SSO
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://sso.company.com/realms/iot
```

## 8. 面试话术

- Q：Security 的过滤器链有哪些？→ 答第2节主链 + "自己加 JWT 过滤器插在认证前"。
- Q：antMatcher 为什么没了？→ API 统一为 requestMatchers（MVC/URL 语义合并），
  新代码不允许再用旧写法。
- Q：RuoYi 登录怎么实现的？→ JWT 过滤器 + SecurityContext + UserDetailsService 查库
  + BCrypt 校验 + @PreAuthorize 方法级权限。
- Q：无状态服务怎么防止 CSRF？→ 无 Cookie 的 token 机制天然免 CSRF，可以 disable；
  有 Cookie 的浏览器场景必须保留。

## 9. 一句话总结

**Security 7 = 删掉旧 DSL 后的"标准姿势"：SecurityFilterChain + lambda 配置 +
认证过滤器 + 授权管理器；理解过滤器链的顺序，就理解了 Security 的全部。**