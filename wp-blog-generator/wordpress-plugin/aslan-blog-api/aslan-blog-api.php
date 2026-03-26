<?php
/**
 * Plugin Name: Aslan Blog API
 * Description: İstanbul Aslan Hamal için güvenli REST API endpoint'i. Blog yazıları oluşturmak için API key tabanlı authentication sağlar.
 * Version: 1.0.0
 * Author: Aslan Hamaliye
 * Text Domain: aslan-blog-api
 */

if (!defined('ABSPATH')) {
    exit;
}

class AslanBlogAPI {

    private $option_name = 'aslan_blog_api_key';

    public function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
        add_action('admin_menu', [$this, 'add_settings_page']);
        add_action('admin_init', [$this, 'register_settings']);

        // İlk kurulumda API key oluştur
        if (!get_option($this->option_name)) {
            update_option($this->option_name, wp_generate_password(32, false));
        }
    }

    /**
     * REST API rotalarını kaydet
     */
    public function register_routes() {
        register_rest_route('aslan/v1', '/status', [
            'methods' => 'GET',
            'callback' => [$this, 'status_endpoint'],
            'permission_callback' => [$this, 'verify_api_key'],
        ]);

        register_rest_route('aslan/v1', '/create-post', [
            'methods' => 'POST',
            'callback' => [$this, 'create_post_endpoint'],
            'permission_callback' => [$this, 'verify_api_key'],
        ]);

        register_rest_route('aslan/v1', '/categories', [
            'methods' => 'GET',
            'callback' => [$this, 'list_categories'],
            'permission_callback' => [$this, 'verify_api_key'],
        ]);

        register_rest_route('aslan/v1', '/create-category', [
            'methods' => 'POST',
            'callback' => [$this, 'create_category_endpoint'],
            'permission_callback' => [$this, 'verify_api_key'],
        ]);
    }

    /**
     * API key doğrulama
     */
    public function verify_api_key($request) {
        $api_key = $request->get_header('X-Aslan-Key');

        if (!$api_key) {
            $api_key = $request->get_param('api_key');
        }

        if (!$api_key) {
            return new WP_Error('missing_key', 'API anahtarı gerekli.', ['status' => 401]);
        }

        $stored_key = get_option($this->option_name);

        if (!hash_equals($stored_key, $api_key)) {
            return new WP_Error('invalid_key', 'Geçersiz API anahtarı.', ['status' => 403]);
        }

        return true;
    }

    /**
     * Durum kontrolü
     */
    public function status_endpoint($request) {
        return rest_ensure_response([
            'status' => 'ok',
            'site' => get_bloginfo('name'),
            'url' => home_url(),
            'wp_version' => get_bloginfo('version'),
            'php_version' => phpversion(),
            'post_count' => wp_count_posts()->publish,
            'timestamp' => current_time('mysql'),
        ]);
    }

    /**
     * Blog yazısı oluştur
     */
    public function create_post_endpoint($request) {
        $params = $request->get_json_params();

        // Zorunlu alanlar
        $title = sanitize_text_field($params['title'] ?? '');
        $content = wp_kses_post($params['content'] ?? '');

        if (empty($title) || empty($content)) {
            return new WP_Error('missing_fields', 'Başlık ve içerik zorunludur.', ['status' => 400]);
        }

        // Opsiyonel alanlar
        $status = sanitize_text_field($params['status'] ?? 'draft');
        $category_ids = $params['categories'] ?? [1];
        $tags = $params['tags'] ?? [];
        $excerpt = sanitize_textarea_field($params['excerpt'] ?? '');
        $slug = sanitize_title($params['slug'] ?? $title);
        $meta_description = sanitize_text_field($params['meta_description'] ?? '');
        $focus_keyword = sanitize_text_field($params['focus_keyword'] ?? '');

        // Geçerli durumlar
        if (!in_array($status, ['publish', 'draft', 'pending'])) {
            $status = 'draft';
        }

        // Post oluştur
        $post_data = [
            'post_title' => $title,
            'post_content' => $content,
            'post_status' => $status,
            'post_type' => 'post',
            'post_excerpt' => $excerpt,
            'post_name' => $slug,
            'post_category' => array_map('intval', (array)$category_ids),
        ];

        $post_id = wp_insert_post($post_data, true);

        if (is_wp_error($post_id)) {
            return new WP_Error('create_failed', 'Post oluşturulamadı: ' . $post_id->get_error_message(), ['status' => 500]);
        }

        // Etiketler ekle
        if (!empty($tags)) {
            wp_set_post_tags($post_id, array_map('sanitize_text_field', (array)$tags));
        }

        // Yoast SEO meta bilgileri (varsa)
        if (!empty($meta_description)) {
            update_post_meta($post_id, '_yoast_wpseo_metadesc', $meta_description);
        }
        if (!empty($focus_keyword)) {
            update_post_meta($post_id, '_yoast_wpseo_focuskw', $focus_keyword);
        }

        // SEO title (varsa)
        $seo_title = sanitize_text_field($params['seo_title'] ?? '');
        if (!empty($seo_title)) {
            update_post_meta($post_id, '_yoast_wpseo_title', $seo_title);
        }

        return rest_ensure_response([
            'success' => true,
            'post_id' => $post_id,
            'url' => get_permalink($post_id),
            'edit_url' => admin_url('post.php?post=' . $post_id . '&action=edit'),
            'status' => $status,
        ]);
    }

    /**
     * Kategorileri listele
     */
    public function list_categories($request) {
        $categories = get_categories(['hide_empty' => false]);
        $result = [];

        foreach ($categories as $cat) {
            $result[] = [
                'id' => $cat->term_id,
                'name' => $cat->name,
                'slug' => $cat->slug,
                'count' => $cat->count,
            ];
        }

        return rest_ensure_response($result);
    }

    /**
     * Kategori oluştur
     */
    public function create_category_endpoint($request) {
        $params = $request->get_json_params();
        $name = sanitize_text_field($params['name'] ?? '');
        $slug = sanitize_title($params['slug'] ?? $name);
        $description = sanitize_textarea_field($params['description'] ?? '');

        if (empty($name)) {
            return new WP_Error('missing_name', 'Kategori adı zorunludur.', ['status' => 400]);
        }

        $result = wp_insert_term($name, 'category', [
            'slug' => $slug,
            'description' => $description,
        ]);

        if (is_wp_error($result)) {
            // Zaten varsa ID'sini döndür
            $existing = get_term_by('slug', $slug, 'category');
            if ($existing) {
                return rest_ensure_response([
                    'success' => true,
                    'category_id' => $existing->term_id,
                    'already_exists' => true,
                ]);
            }
            return new WP_Error('create_failed', $result->get_error_message(), ['status' => 500]);
        }

        return rest_ensure_response([
            'success' => true,
            'category_id' => $result['term_id'],
            'already_exists' => false,
        ]);
    }

    /**
     * Admin ayarları sayfası
     */
    public function add_settings_page() {
        add_options_page(
            'Aslan Blog API',
            'Aslan Blog API',
            'manage_options',
            'aslan-blog-api',
            [$this, 'settings_page_html']
        );
    }

    public function register_settings() {
        register_setting('aslan_blog_api', $this->option_name);
    }

    public function settings_page_html() {
        if (!current_user_can('manage_options')) return;

        $api_key = get_option($this->option_name);
        ?>
        <div class="wrap">
            <h1>Aslan Blog API Ayarları</h1>
            <form method="post" action="options.php">
                <?php settings_fields('aslan_blog_api'); ?>
                <table class="form-table">
                    <tr>
                        <th scope="row">API Anahtarı</th>
                        <td>
                            <input type="text" name="<?php echo $this->option_name; ?>"
                                   value="<?php echo esc_attr($api_key); ?>"
                                   class="regular-text" readonly
                                   onclick="this.select()" />
                            <p class="description">
                                Bu anahtarı blog üretim scriptinde kullanın.
                                <strong>Kimseyle paylaşmayın!</strong>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">API Durumu</th>
                        <td>
                            <code><?php echo home_url('/wp-json/aslan/v1/status?api_key=' . $api_key); ?></code>
                            <p class="description">Bu URL'yi tarayıcıda açarak API'nin çalıştığını test edebilirsiniz.</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button('Kaydet'); ?>
            </form>

            <hr />
            <h2>Yeni API Anahtarı Oluştur</h2>
            <form method="post" action="">
                <?php wp_nonce_field('aslan_regenerate_key'); ?>
                <input type="hidden" name="aslan_regenerate" value="1" />
                <?php submit_button('Yeni Anahtar Oluştur', 'secondary'); ?>
            </form>
        </div>
        <?php

        // Yeni anahtar oluşturma
        if (isset($_POST['aslan_regenerate']) && wp_verify_nonce($_POST['_wpnonce'], 'aslan_regenerate_key')) {
            $new_key = wp_generate_password(32, false);
            update_option($this->option_name, $new_key);
            echo '<script>location.reload();</script>';
        }
    }
}

new AslanBlogAPI();
