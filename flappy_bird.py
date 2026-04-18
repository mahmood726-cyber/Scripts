import pygame
import random
import sys

# Initialize Pygame
pygame.init()

# Screen settings
SCREEN_WIDTH, SCREEN_HEIGHT = 400, 600
SCREEN = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption('Flappy Bird')

# Clock for controlling frame rate
clock = pygame.time.Clock()
FPS = 60

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
GREEN = (0, 200, 0)
BLUE = (0, 0, 255)

# Bird settings
BIRD_WIDTH, BIRD_HEIGHT = 40, 30
GRAVITY = 0.5
JUMP_STRENGTH = -10

# Pipe settings
PIPE_WIDTH = 60
PIPE_GAP = 150
PIPE_SPEED = 3
PIPE_DISTANCE = 200  # distance between pipes

class Bird:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.vel_y = 0
        self.rect = pygame.Rect(self.x, self.y, BIRD_WIDTH, BIRD_HEIGHT)

    def update(self):
        # Apply gravity
        self.vel_y += GRAVITY
        self.y += self.vel_y
        self.rect.y = int(self.y)

    def jump(self):
        self.vel_y = JUMP_STRENGTH

    def draw(self):
        pygame.draw.rect(SCREEN, BLUE, self.rect)

class Pipe:
    def __init__(self, x):
        self.x = x
        # Generate random height for top pipe
        self.height = random.randint(50, SCREEN_HEIGHT - PIPE_GAP - 50)
        self.top_rect = pygame.Rect(self.x, 0, PIPE_WIDTH, self.height)
        self.bottom_rect = pygame.Rect(self.x, self.height + PIPE_GAP, PIPE_WIDTH, SCREEN_HEIGHT - (self.height + PIPE_GAP))
        self.passed = False

    def update(self):
        self.x -= PIPE_SPEED
        self.top_rect.x = int(self.x)
        self.bottom_rect.x = int(self.x)

    def draw(self):
        pygame.draw.rect(SCREEN, GREEN, self.top_rect)
        pygame.draw.rect(SCREEN, GREEN, self.bottom_rect)

    def collide(self, bird_rect):
        return self.top_rect.colliderect(bird_rect) or self.bottom_rect.colliderect(bird_rect)


def draw_text(text, size, color, x, y):
    font = pygame.font.SysFont('Arial', size)
    text_surface = font.render(text, True, color)
    text_rect = text_surface.get_rect()
    text_rect.center = (x, y)
    SCREEN.blit(text_surface, text_rect)


def main():
    run_game = True
    # Create bird instance
    bird = Bird(50, SCREEN_HEIGHT // 2)

    # Pipe list
    pipes = [Pipe(SCREEN_WIDTH + i * PIPE_DISTANCE) for i in range(3)]

    # Score
    score = 0

    while run_game:
        clock.tick(FPS)
        # Event handling
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE or event.key == pygame.K_UP:
                    bird.jump()

        # Update bird
        bird.update()

        # Update pipes
        for pipe in pipes:
            pipe.update()
            # Check collision
            if pipe.collide(bird.rect):
                run_game = False
            # Check if pipe passed bird for scoring
            if not pipe.passed and pipe.x + PIPE_WIDTH < bird.x:
                pipe.passed = True
                score += 1
            # Remove off-screen pipes and add new ones
            if pipe.x + PIPE_WIDTH < 0:
                pipes.remove(pipe)
                pipes.append(Pipe(pipes[-1].x + PIPE_DISTANCE))

        # Check if bird hits ground or goes off top
        if bird.rect.top <= 0 or bird.rect.bottom >= SCREEN_HEIGHT:
            run_game = False

        # Draw everything
        SCREEN.fill(WHITE)
        # Draw pipes
        for pipe in pipes:
            pipe.draw()
        # Draw bird
        bird.draw()
        # Draw score
        draw_text(f"Score: {score}", 30, BLACK, SCREEN_WIDTH // 2, 30)

        pygame.display.flip()

    # Game over screen
    draw_text("Game Over", 60, BLACK, SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 - 50)
    draw_text(f"Final Score: {score}", 40, BLACK, SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 10)
    draw_text("Press any key to exit", 25, BLACK, SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 50)
    pygame.display.flip()
    waiting = True
    while waiting:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                waiting = False
            if event.type == pygame.KEYDOWN:
                waiting = False
    pygame.quit()

if __name__ == "__main__":
    main()
